import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AgentSession, AgentSessionEvent, AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent'
import { AgentController } from '../../src/agent/AgentController'
import { LoginController } from '../../src/agent/LoginController'
import { AgentRunStorage } from '../../src/agent/runStorage'
import type { AgentRunState } from '../../src/agent/types'

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
