import { describe, expect, test } from 'bun:test'
import type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent'
import { AgentController } from '../../src/agent/AgentController'
import { LoginController } from '../../src/agent/LoginController'
import type { TicketRunContext } from '../../src/agent/types'

const stubAuthStorage = {
  get: () => undefined,
  getOAuthProviders: () => [],
} as any

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
} as any

function makeTicket(overrides: Partial<TicketRunContext> & { ticketId: string }): TicketRunContext {
  return {
    ticketId: overrides.ticketId,
    title: overrides.title ?? overrides.ticketId,
    body: overrides.body ?? '',
    filePath: overrides.filePath ?? `/tickets/${overrides.ticketId}.md`,
  }
}

function createMockSession() {
  const listeners = new Set<(event: AgentSessionEvent) => void>()
  const promptCalls: string[] = []
  let isStreaming = false

  const session = {
    sessionId: 'session-1',
    sessionFile: '/tmp/session-1.jsonl',
    model: { provider: 'test', id: 'mock-model' },
    get isStreaming() {
      return isStreaming
    },
    async prompt(text: string) {
      promptCalls.push(text)
    },
    async abort() {
      isStreaming = false
    },
    subscribe(listener: (event: AgentSessionEvent) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {},
  } as unknown as AgentSession

  return {
    session,
    promptCalls,
    emit(event: AgentSessionEvent) {
      if (event.type === 'agent_start') isStreaming = true
      if (event.type === 'agent_end') isStreaming = false
      for (const listener of listeners) listener(event)
    },
  }
}

describe('AgentController', () => {
  test('creates multiple retained runs and seeds each one with a TDD ticket prompt', async () => {
    const firstSession = createMockSession()
    const secondSession = createMockSession()
    const sessions = [firstSession, secondSession]
    let runNumber = 0
    const now = (() => {
      let current = 1000
      return () => ++current
    })()
    const controller = new AgentController('/project', {
      createSession: async () => ({ session: sessions.shift()!.session }),
      createRunId: () => `run-${++runNumber}`,
      now,
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
    })

    const firstTicket = makeTicket({
      ticketId: 'awb-1',
      title: 'First task',
      filePath: '/project/tickets/awb-1.md',
      body: 'Implement the first task.',
    })
    const secondTicket = makeTicket({
      ticketId: 'awb-2',
      title: 'Second task',
      filePath: '/project/tickets/awb-2.md',
      body: 'Implement the second task.',
    })

    const firstRun = await controller.createRun(firstTicket)
    const secondRun = await controller.createRun(secondTicket)
    await Promise.resolve()
    await Promise.resolve()

    expect(controller.listRuns().map((run) => run.id)).toEqual(['run-2', 'run-1'])
    expect(controller.getRun(firstRun.id)?.ticket).toEqual(firstTicket)
    expect(controller.getRun(secondRun.id)?.ticket).toEqual(secondTicket)
    expect(controller.getRun(firstRun.id)?.worktree).toEqual({
      mode: 'shared-project',
      status: 'not-requested',
    })
    expect(controller.getRun(secondRun.id)?.worktree).toEqual({
      mode: 'shared-project',
      status: 'not-requested',
    })

    expect(firstSession.promptCalls[0]).toContain('Use red/green TDD to implement this ticket.')
    expect(firstSession.promptCalls[0]).toContain('Ticket ID: awb-1')
    expect(firstSession.promptCalls[0]).toContain('Ticket Title: First task')
    expect(firstSession.promptCalls[0]).toContain('Ticket File: /project/tickets/awb-1.md')
    expect(firstSession.promptCalls[0]).toContain('Implement the first task.')

    expect(secondSession.promptCalls[0]).toContain('Ticket ID: awb-2')
    expect(secondSession.promptCalls[0]).toContain('Implement the second task.')
  })

  test('records transcript and tool activity on a specific run', async () => {
    const mockSession = createMockSession()
    const now = (() => {
      let current = 2000
      return () => ++current
    })()
    const controller = new AgentController('/project', {
      createSession: async () => ({ session: mockSession.session }),
      createRunId: () => 'run-1',
      now,
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
    })

    const run = await controller.createRun(makeTicket({ ticketId: 'awb-1', body: 'Do the thing.' }))
    await Promise.resolve()

    mockSession.emit({ type: 'agent_start' } as AgentSessionEvent)
    mockSession.emit({
      type: 'tool_execution_start',
      toolCallId: 'tool-1',
      toolName: 'read',
      args: { path: 'src/index.ts' },
    } as AgentSessionEvent)
    mockSession.emit({
      type: 'tool_execution_end',
      toolCallId: 'tool-1',
      toolName: 'read',
      result: { ok: true },
      isError: false,
    } as AgentSessionEvent)
    mockSession.emit({
      type: 'message_update',
      message: { timestamp: 2100 },
      assistantMessageEvent: { type: 'text_delta', delta: 'Hello' },
    } as AgentSessionEvent)
    mockSession.emit({
      type: 'message_end',
      message: {
        role: 'assistant',
        timestamp: 2100,
        content: [{ type: 'text', text: 'Hello world' }],
      },
    } as AgentSessionEvent)
    mockSession.emit({ type: 'agent_end' } as AgentSessionEvent)

    await controller.promptRun(run.id, 'Please add a regression test.')

    const next = controller.getRun(run.id)
    expect(next?.status).toBe('completed')
    expect(next?.transcript.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ['user', expect.stringContaining('Ticket ID: awb-1')],
      ['assistant', 'Hello world'],
      ['user', 'Please add a regression test.'],
    ])
    expect(next?.transcript.toolActivity).toEqual([
      expect.objectContaining({ toolCallId: 'tool-1', toolName: 'read', isError: false }),
    ])
    expect(mockSession.promptCalls.at(-1)).toBe('Please add a regression test.')
  })

  test('aborts a run and keeps it available in memory', async () => {
    const mockSession = createMockSession()
    const now = (() => {
      let current = 3000
      return () => ++current
    })()
    const controller = new AgentController('/project', {
      createSession: async () => ({ session: mockSession.session }),
      createRunId: () => 'run-1',
      now,
      loginController: new LoginController({ authStorage: stubAuthStorage, modelRegistry: stubModelRegistry, now }),
      credentialProvider: stubCredentialProvider,
      modelRegistry: stubModelRegistry,
    })

    const run = await controller.createRun(makeTicket({ ticketId: 'awb-1' }))
    await Promise.resolve()
    mockSession.emit({ type: 'agent_start' } as AgentSessionEvent)

    await controller.abortRun(run.id)

    const next = controller.getRun(run.id)
    expect(next?.status).toBe('aborted')
    expect(next?.abortedAt).toBeDefined()
    expect(controller.listRuns()).toHaveLength(1)
  })
})
