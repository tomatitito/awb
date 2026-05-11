import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AgentSession, AgentSessionEvent, AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent'
import { AgentController } from '../../src/agent/AgentController'
import { LoginController } from '../../src/agent/LoginController'
import { AgentRunStorage } from '../../src/agent/runStorage'
import type { AgentRunState, AgentRunWorktreeState } from '../../src/agent/types'

const tempDirs: string[] = []

const stubAuthStorage = {
  get: () => undefined,
  getOAuthProviders: () => [],
} as unknown as AuthStorage

const stubCredentialProvider = {
  get: () => undefined,
  getApiKey: async () => undefined,
  has: () => false,
  hasAuth: () => false,
}

const stubModelRegistry = {
  refresh: () => {},
  getAll: () => [],
  hasConfiguredAuth: () => false,
} as unknown as ModelRegistry

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('AgentRunStorage', () => {
  test('persists one atomic JSON file per run and loads it back with resume health', async () => {
    const projectDir = await makeTempProject()
    const sessionFile = path.join(projectDir, '.awb', 'pi-sessions', 'session.jsonl')
    await fs.mkdir(path.dirname(sessionFile), { recursive: true })
    await fs.writeFile(sessionFile, '{"type":"header"}\n')
    const storage = new AgentRunStorage(projectDir, () => 2000)
    const run = makeRun({ sessionFile })

    storage.save(run)

    const raw = JSON.parse(await fs.readFile(path.join(projectDir, '.awb', 'agent-runs', 'run-1.json'), 'utf8'))
    expect(raw.storageVersion).toBe(1)
    expect(raw.projectDir).toBe(projectDir)
    expect(raw.run.id).toBe('run-1')
    expect(raw.run.resume).toBeUndefined()
    expect(raw.resume.state).toBe('available')

    const loaded = storage.load()
    expect(loaded.warnings).toEqual([])
    expect(loaded.runs).toEqual([
      expect.objectContaining({
        id: 'run-1',
        status: 'completed',
        queuedSteeringCount: 0,
        queuedFollowUpCount: 0,
        resume: expect.objectContaining({ state: 'available' }),
      }),
    ])
  })

  test('ignores orphan temp files on startup', async () => {
    const projectDir = await makeTempProject()
    const runsDir = path.join(projectDir, '.awb', 'agent-runs')
    await fs.mkdir(runsDir, { recursive: true })
    await fs.writeFile(path.join(runsDir, 'run-1.json.tmp-123-deadbeef'), '{ invalid')

    const loaded = new AgentRunStorage(projectDir, () => 2000).load()

    expect(loaded).toEqual({ runs: [], warnings: [] })
  })

  test('skips corrupt run files without blocking startup', async () => {
    const projectDir = await makeTempProject()
    const runsDir = path.join(projectDir, '.awb', 'agent-runs')
    await fs.mkdir(runsDir, { recursive: true })
    await fs.writeFile(path.join(runsDir, 'broken.json'), '{ invalid')

    const loaded = new AgentRunStorage(projectDir, () => 2000).load()

    expect(loaded.runs).toEqual([])
    expect(loaded.warnings).toEqual([expect.stringContaining('Ignoring persisted agent run')])
  })

  test('fills migration defaults for older run files', async () => {
    const projectDir = await makeTempProject()
    const runsDir = path.join(projectDir, '.awb', 'agent-runs')
    await fs.mkdir(runsDir, { recursive: true })
    await fs.writeFile(
      path.join(runsDir, 'run-1.json'),
      JSON.stringify({
        run: {
          id: 'run-1',
          context: { kind: 'unticketed', title: 'Old chat' },
          status: 'closed',
          createdAt: 1000,
          updatedAt: 1100,
          transcript: { runId: 'run-1', initialPrompt: 'Old chat', entries: [], toolActivity: [], updatedAt: 1100 },
        },
      }),
    )

    const loaded = new AgentRunStorage(projectDir, () => 2000).load()

    expect(loaded.warnings).toEqual([])
    expect(loaded.runs[0]).toEqual(
      expect.objectContaining({
        queuedSteeringCount: 0,
        queuedFollowUpCount: 0,
        worktree: { mode: 'shared-project', status: 'not-requested' },
        resume: expect.objectContaining({ state: 'not-started' }),
      }),
    )
  })

  test('loads stale in-flight runs as failed', async () => {
    const projectDir = await makeTempProject()
    const storage = new AgentRunStorage(projectDir, () => 2000)
    storage.save(makeRun({ status: 'running', updatedAt: 1200 }))

    const loaded = storage.load()

    expect(loaded.runs[0]).toEqual(
      expect.objectContaining({
        status: 'failed',
        completedAt: 2000,
        lastError: 'AWB stopped before this run completed.',
      }),
    )
  })

  test('AgentController persists created runs and reloads previous run records on startup', async () => {
    const projectDir = await makeTempProject()
    const storage = new AgentRunStorage(projectDir, () => 3000)
    let listener: ((event: AgentSessionEvent) => void) | undefined
    const session = {
      sessionId: 'session-1',
      sessionFile: path.join(projectDir, '.awb', 'pi-sessions', 'session-1.jsonl'),
      model: { provider: 'test', id: 'mock-model' },
      subscribe: (next: (event: AgentSessionEvent) => void) => {
        listener = next
        return () => {
          listener = undefined
        }
      },
      prompt: async () => {},
      abort: async () => {},
      dispose: () => {},
    } as unknown as AgentSession
    await fs.mkdir(path.dirname(session.sessionFile), { recursive: true })
    await fs.writeFile(session.sessionFile, '{"type":"header"}\n')
    const first = new AgentController(projectDir, {
      createSession: async () => ({ session }),
      createRunId: () => 'run-1',
      now: () => 3000,
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now: () => 3000 }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
      runStorage: storage,
    })

    await first.createUnticketedRun('Persist this chat.')
    await Promise.resolve()
    listener?.({
      type: 'message_end',
      message: {
        role: 'assistant',
        timestamp: 3100,
        content: [{ type: 'text', text: 'Persisted answer.' }],
      },
    } as AgentSessionEvent)
    first.dispose()

    const second = new AgentController(projectDir, {
      createSession: async () => {
        throw new Error('persisted runs should not reopen sessions during startup')
      },
      createRunId: () => 'run-2',
      now: () => 4000,
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now: () => 4000 }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
      runStorage: new AgentRunStorage(projectDir, () => 4000),
    })

    await second.ensureStarted()

    expect(second.listRuns()).toEqual([
      expect.objectContaining({
        id: 'run-1',
        context: { kind: 'unticketed', title: 'Persist this chat.' },
        transcript: expect.objectContaining({
          initialPrompt: 'Persist this chat.',
          entries: [expect.objectContaining({ role: 'user', text: 'Persist this chat.' }), expect.objectContaining({ role: 'assistant', text: 'Persisted answer.' })],
        }),
      }),
    ])
  })

  test('AgentController reopens a persisted shared-project run for follow-up prompts after restart', async () => {
    const projectDir = await makeTempProject()
    const sessionFile = path.join(projectDir, '.awb', 'pi-sessions', 'session-1.jsonl')
    await fs.mkdir(path.dirname(sessionFile), { recursive: true })
    await fs.writeFile(sessionFile, '{"type":"session","id":"session-1","timestamp":"2026-05-11T00:00:00.000Z","cwd":"ignored"}\n')
    new AgentRunStorage(projectDir, () => 3000).save(makeRun({ sessionId: 'session-1', sessionFile }))

    const reopened = createMockSession({ sessionId: 'session-1', sessionFile })
    const createSessionCalls: Array<{ cwd?: string; sessionFile?: string }> = []
    const controller = new AgentController(projectDir, {
      createSession: async (_projectDir, options) => {
        createSessionCalls.push({ cwd: options.cwd, sessionFile: options.sessionFile })
        return { session: reopened.session }
      },
      createRunId: () => {
        throw new Error('prompting a persisted run must not create a new run')
      },
      now: createIncrementingNow(4000),
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now: () => 4000 }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
      runStorage: new AgentRunStorage(projectDir, () => 4000),
    })

    await controller.ensureStarted()
    await controller.promptRun('run-1', 'Continue after restart.')

    expect(createSessionCalls).toEqual([{ cwd: projectDir, sessionFile }])
    expect(controller.listRuns().map((run) => run.id)).toEqual(['run-1'])
    expect(reopened.promptCalls).toEqual(['Continue after restart.'])
    expect(controller.getRun('run-1')?.transcript.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ['user', 'Hello'],
      ['user', 'Continue after restart.'],
    ])
    expect(controller.getRun('run-1')?.resume).toEqual(expect.objectContaining({ state: 'available' }))
  })

  test('AgentController reopens persisted worktree runs in the retained worktree cwd', async () => {
    const projectDir = await makeTempProject()
    const worktreePath = path.join(projectDir, '.awb', 'worktrees', 'run-1')
    const sessionFile = path.join(projectDir, '.awb', 'pi-sessions', 'session-1.jsonl')
    await fs.mkdir(worktreePath, { recursive: true })
    await fs.mkdir(path.dirname(sessionFile), { recursive: true })
    await fs.writeFile(sessionFile, '{"type":"session","id":"session-1","timestamp":"2026-05-11T00:00:00.000Z","cwd":"ignored"}\n')
    new AgentRunStorage(projectDir, () => 3000).save(
      makeRun({
        sessionId: 'session-1',
        sessionFile,
        worktree: makeWorktree({ path: worktreePath }),
      }),
    )

    const reopened = createMockSession({ sessionId: 'session-1', sessionFile })
    const createSessionCalls: Array<{ cwd?: string; sessionFile?: string }> = []
    const controller = new AgentController(projectDir, {
      createSession: async (_projectDir, options) => {
        createSessionCalls.push({ cwd: options.cwd, sessionFile: options.sessionFile })
        return { session: reopened.session }
      },
      createRunId: () => 'unused',
      now: createIncrementingNow(5000),
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now: () => 5000 }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
      runStorage: new AgentRunStorage(projectDir, () => 5000),
    })

    await controller.ensureStarted()
    await controller.promptRun('run-1', 'Continue in the retained worktree.')

    expect(createSessionCalls).toEqual([{ cwd: worktreePath, sessionFile }])
    expect(reopened.promptCalls).toEqual(['Continue in the retained worktree.'])
  })

  test('AgentController rejects persisted prompts when resume health is unavailable', async () => {
    const projectDir = await makeTempProject()
    const missingSessionFile = path.join(projectDir, '.awb', 'pi-sessions', 'missing.jsonl')
    new AgentRunStorage(projectDir, () => 3000).save(makeRun({ sessionId: 'session-1', sessionFile: missingSessionFile }))

    const controller = new AgentController(projectDir, {
      createSession: async () => {
        throw new Error('unavailable resume state must not open a session')
      },
      createRunId: () => 'unused',
      now: createIncrementingNow(6000),
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now: () => 6000 }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
      runStorage: new AgentRunStorage(projectDir, () => 6000),
    })

    await controller.ensureStarted()

    await expect(controller.promptRun('run-1', 'Continue.')).rejects.toThrow(`Session file ${missingSessionFile} does not exist.`)
    expect(controller.getRun('run-1')?.resume).toEqual(expect.objectContaining({ state: 'missing-session-file' }))
    expect(controller.getRun('run-1')?.transcript.entries.map((entry) => entry.text)).toEqual(['Hello'])
  })

  test('AgentController does not resume cleaned or missing worktree runs in the main checkout', async () => {
    const projectDir = await makeTempProject()
    const sessionFile = path.join(projectDir, '.awb', 'pi-sessions', 'session-1.jsonl')
    await fs.mkdir(path.dirname(sessionFile), { recursive: true })
    await fs.writeFile(sessionFile, '{"type":"session","id":"session-1","timestamp":"2026-05-11T00:00:00.000Z","cwd":"ignored"}\n')
    new AgentRunStorage(projectDir, () => 3000).save(
      makeRun({
        sessionId: 'session-1',
        sessionFile,
        worktree: makeWorktree({ path: path.join(projectDir, '.awb', 'worktrees', 'run-1'), status: 'cleaned' }),
      }),
    )

    const controller = new AgentController(projectDir, {
      createSession: async () => {
        throw new Error('cleaned worktree runs must not open a session')
      },
      createRunId: () => 'unused',
      now: createIncrementingNow(7000),
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now: () => 7000 }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
      runStorage: new AgentRunStorage(projectDir, () => 7000),
    })

    await controller.ensureStarted()

    await expect(controller.promptRun('run-1', 'Continue.')).rejects.toThrow('Worktree for run run-1 was cleaned.')
    expect(controller.getRun('run-1')?.resume).toEqual(expect.objectContaining({ state: 'worktree-cleaned' }))
  })

  test('AgentController records invalid session files when reopening fails', async () => {
    const projectDir = await makeTempProject()
    const sessionFile = path.join(projectDir, '.awb', 'pi-sessions', 'session-1.jsonl')
    await fs.mkdir(path.dirname(sessionFile), { recursive: true })
    await fs.writeFile(sessionFile, 'not jsonl\n')
    new AgentRunStorage(projectDir, () => 3000).save(makeRun({ sessionId: 'session-1', sessionFile }))

    const controller = new AgentController(projectDir, {
      createSession: async () => {
        throw new Error('invalid session contents')
      },
      createRunId: () => 'unused',
      now: createIncrementingNow(8000),
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now: () => 8000 }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
      runStorage: new AgentRunStorage(projectDir, () => 8000),
    })

    await controller.ensureStarted()

    await expect(controller.promptRun('run-1', 'Continue.')).rejects.toThrow('invalid pi session file. invalid session contents')
    expect(controller.getRun('run-1')?.resume).toEqual(expect.objectContaining({ state: 'invalid-session-file', error: 'invalid session contents' }))
    expect(controller.getRun('run-1')?.transcript.entries.map((entry) => entry.text)).toEqual(['Hello'])
  })
})

async function makeTempProject(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-agent-runs-'))
  tempDirs.push(projectDir)
  return projectDir
}

function makeRun(overrides: Partial<AgentRunState> = {}): AgentRunState {
  return {
    id: 'run-1',
    context: { kind: 'unticketed', title: 'Chat' },
    status: 'completed',
    createdAt: 1000,
    startedAt: 1001,
    completedAt: 1100,
    updatedAt: 1100,
    transcript: {
      runId: 'run-1',
      initialPrompt: 'Hello',
      entries: [{ id: 'run-1:user:initial', role: 'user', text: 'Hello', timestamp: 1000 }],
      toolActivity: [],
      updatedAt: 1100,
    },
    queuedSteeringCount: 0,
    queuedFollowUpCount: 0,
    worktree: { mode: 'shared-project', status: 'not-requested' },
    ...overrides,
  }
}

function makeWorktree(overrides: Partial<AgentRunWorktreeState> = {}): AgentRunWorktreeState {
  return {
    mode: 'git-worktree',
    status: 'ready',
    path: '/tmp/awb-worktree',
    branch: 'awb/run/run-1',
    baseRef: 'HEAD',
    headSha: 'abc123',
    createdAt: 1001,
    lastCheckedAt: 1001,
    ...overrides,
  }
}

function createIncrementingNow(start: number): () => number {
  let current = start
  return () => ++current
}

function createMockSession(options: { sessionId: string; sessionFile: string }) {
  const listeners = new Set<(event: AgentSessionEvent) => void>()
  const promptCalls: string[] = []
  const session = {
    sessionId: options.sessionId,
    sessionFile: options.sessionFile,
    model: { provider: 'test', id: 'mock-model' },
    subscribe: (next: (event: AgentSessionEvent) => void) => {
      listeners.add(next)
      return () => {
        listeners.delete(next)
      }
    },
    prompt: async (text: string) => {
      promptCalls.push(text)
    },
    abort: async () => {},
    dispose: () => {},
  } as unknown as AgentSession
  return { session, promptCalls }
}
