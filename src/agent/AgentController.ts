import type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent'
import type { AssistantMessage } from '@mariozechner/pi-ai'
import { createPiSession } from './createPiSession.js'
import type {
  AgentPanelEvent,
  AgentPanelState,
  AgentRunEvent,
  AgentRunState,
  AgentToolActivityEntry,
  SelectedTicketContext,
  TicketRunContext,
} from './types.js'

type SessionFactory = typeof createPiSession

type RunRecord = {
  run: AgentRunState
  session?: AgentSession
  unsubscribeSession?: () => void
}

type AgentControllerOptions = {
  createSession?: SessionFactory
  createRunId?: () => string
  now?: () => number
}

export class AgentController {
  private readonly listeners = new Set<(event: AgentRunEvent) => void>()
  private readonly createSession: SessionFactory
  private readonly createRunId: () => string
  private readonly now: () => number
  private readonly runs = new Map<string, RunRecord>()
  private runOrder: string[] = []
  private selectedTicket?: SelectedTicketContext

  constructor(
    private readonly projectDir: string,
    options: AgentControllerOptions = {},
  ) {
    this.createSession = options.createSession ?? createPiSession
    this.createRunId = options.createRunId ?? (() => crypto.randomUUID())
    this.now = options.now ?? (() => Date.now())
  }

  async ensureStarted(): Promise<void> {
    return
  }

  getState(): AgentPanelState {
    const latestRun = this.getLatestRun()
    if (!latestRun) {
      return {
        status: 'idle',
        selectedTicketId: this.selectedTicket?.ticketId,
        isStreaming: false,
        queuedSteeringCount: 0,
        queuedFollowUpCount: 0,
      }
    }

    return {
      status: this.toPanelStatus(latestRun.status),
      sessionId: latestRun.sessionId,
      sessionFile: latestRun.sessionFile,
      model: latestRun.model,
      selectedTicketId: this.selectedTicket?.ticketId ?? latestRun.ticket.ticketId,
      lastError: latestRun.lastError,
      isStreaming: latestRun.status === 'running' || latestRun.status === 'starting',
      queuedSteeringCount: latestRun.queuedSteeringCount,
      queuedFollowUpCount: latestRun.queuedFollowUpCount,
    }
  }

  subscribe(listener: (event: AgentRunEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  listRuns(): AgentRunState[] {
    return this.runOrder
      .map((runId) => this.runs.get(runId)?.run)
      .filter((run): run is AgentRunState => Boolean(run))
  }

  getRun(runId: string): AgentRunState | undefined {
    return this.runs.get(runId)?.run
  }

  setSelectedTicket(ticket: SelectedTicketContext | undefined): void {
    this.selectedTicket = ticket
  }

  async createRun(ticket: TicketRunContext): Promise<AgentRunState> {
    const runId = this.createRunId()
    const createdAt = this.now()
    const initialPrompt = this.buildInitialPrompt(ticket)
    const run: AgentRunState = {
      id: runId,
      ticket,
      status: 'queued',
      createdAt,
      updatedAt: createdAt,
      initialPrompt,
      transcript: [
        {
          id: `${runId}:user:initial`,
          role: 'user',
          text: initialPrompt,
          timestamp: createdAt,
        },
      ],
      toolActivity: [],
      queuedSteeringCount: 0,
      queuedFollowUpCount: 0,
      worktree: {},
    }

    this.runs.set(runId, { run })
    this.runOrder = [runId, ...this.runOrder]
    this.emit({ type: 'run-created', run })
    void this.startRun(runId)
    return run
  }

  async promptRun(runId: string, text: string): Promise<void> {
    const userText = text.trim()
    if (!userText) throw new Error('Prompt text is required.')

    const record = this.requireRun(runId)
    if (!record.session) throw new Error(`Run ${runId} is not ready for follow-up prompts yet.`)
    if (record.run.status === 'aborted') throw new Error(`Run ${runId} has already been aborted.`)

    const timestamp = this.now()
    record.run.transcript.push({
      id: `${runId}:user:${timestamp}`,
      role: 'user',
      text: userText,
      timestamp,
    })
    record.run.updatedAt = timestamp
    this.emit({ type: 'run-output', runId, entry: record.run.transcript[record.run.transcript.length - 1]! })
    this.emitRunUpdated(record.run)
    await record.session.prompt(userText)
  }

  async abortRun(runId: string): Promise<void> {
    const record = this.requireRun(runId)
    if (record.session) {
      await record.session.abort()
    }

    const timestamp = this.now()
    record.run.status = 'aborted'
    record.run.abortedAt = timestamp
    record.run.completedAt ??= timestamp
    record.run.updatedAt = timestamp
    this.emitRunUpdated(record.run)
  }

  async prompt(text: string): Promise<void> {
    const latestRun = this.getLatestRun()
    if (!latestRun) {
      if (!this.selectedTicket) {
        throw new Error('Select a ticket before prompting the agent.')
      }
      const run = await this.createRun(this.selectedTicket)
      if (text.trim()) {
        await this.promptRun(run.id, text)
      }
      return
    }

    await this.promptRun(latestRun.id, text)
  }

  async abort(): Promise<void> {
    const latestRun = this.getLatestRun()
    if (!latestRun) return
    await this.abortRun(latestRun.id)
  }

  dispose(): void {
    for (const record of this.runs.values()) {
      record.unsubscribeSession?.()
      record.session?.dispose()
    }
    this.runs.clear()
    this.runOrder = []
  }

  buildInitialPrompt(ticket: TicketRunContext): string {
    return [
      'You are working inside AWB on a ticket-backed background agent run.',
      'Use red/green TDD to implement this ticket.',
      '',
      `Ticket ID: ${ticket.ticketId}`,
      `Ticket Title: ${ticket.title}`,
      `Ticket File: ${ticket.filePath}`,
      '',
      'Ticket Body:',
      ticket.body || '(empty)',
    ].join('\n')
  }

  private async startRun(runId: string): Promise<void> {
    const record = this.requireRun(runId)
    const startedAt = this.now()
    record.run.status = 'starting'
    record.run.startedAt = startedAt
    record.run.updatedAt = startedAt
    this.emitRunUpdated(record.run)

    try {
      const { session } = await this.createSession(this.projectDir)
      record.session = session
      record.unsubscribeSession = session.subscribe((event) => {
        this.handleSessionEvent(runId, event)
      })
      record.run.sessionId = session.sessionId
      record.run.sessionFile = session.sessionFile
      record.run.model = session.model
        ? { provider: session.model.provider, id: session.model.id }
        : undefined
      record.run.updatedAt = this.now()
      this.emitRunUpdated(record.run)
      await session.prompt(record.run.initialPrompt)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const timestamp = this.now()
      record.run.status = 'failed'
      record.run.completedAt = timestamp
      record.run.updatedAt = timestamp
      record.run.lastError = message
      record.run.transcript.push({
        id: `${runId}:error:${timestamp}`,
        role: 'error',
        text: message,
        timestamp,
        errorMessage: message,
      })
      this.emit({ type: 'error', runId, message })
      this.emitRunUpdated(record.run)
    }
  }

  private handleSessionEvent(runId: string, event: AgentSessionEvent): void {
    const record = this.runs.get(runId)
    if (!record) return

    switch (event.type) {
      case 'agent_start': {
        record.run.status = 'running'
        record.run.updatedAt = this.now()
        this.emitRunUpdated(record.run)
        return
      }
      case 'agent_end': {
        const timestamp = this.now()
        if (record.run.status !== 'aborted' && record.run.status !== 'failed') {
          record.run.status = record.run.lastError ? 'failed' : 'completed'
        }
        record.run.completedAt ??= timestamp
        record.run.updatedAt = timestamp
        this.emitRunUpdated(record.run)
        return
      }
      case 'queue_update': {
        record.run.queuedSteeringCount = event.steering.length
        record.run.queuedFollowUpCount = event.followUp.length
        record.run.updatedAt = this.now()
        this.emitRunUpdated(record.run)
        return
      }
      case 'message_update': {
        if (event.assistantMessageEvent.type !== 'text_delta') return
        const timestamp = event.message.timestamp
        const lastEntry = record.run.transcript[record.run.transcript.length - 1]
        if (lastEntry?.role === 'assistant' && lastEntry.isStreaming) {
          lastEntry.text = `${lastEntry.text}${event.assistantMessageEvent.delta}`
          lastEntry.timestamp = timestamp
          record.run.updatedAt = this.now()
          this.emitRunUpdated(record.run)
          return
        }

        const entry = {
          id: `${runId}:assistant:${timestamp}`,
          role: 'assistant' as const,
          text: event.assistantMessageEvent.delta,
          timestamp,
          isStreaming: true,
        }
        record.run.transcript.push(entry)
        record.run.updatedAt = this.now()
        this.emit({ type: 'run-output', runId, entry })
        this.emitRunUpdated(record.run)
        return
      }
      case 'message_end': {
        if (event.message.role !== 'assistant') return
        const message = event.message as AssistantMessage
        const text = message.content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('')
        const timestamp = message.timestamp
        const lastEntry = record.run.transcript[record.run.transcript.length - 1]
        if (lastEntry?.role === 'assistant' && lastEntry.isStreaming) {
          lastEntry.text = text || lastEntry.text
          lastEntry.timestamp = timestamp
          lastEntry.isStreaming = false
          lastEntry.errorMessage = message.errorMessage
        } else {
          record.run.transcript.push({
            id: `${runId}:assistant:${timestamp}`,
            role: 'assistant',
            text,
            timestamp,
            isStreaming: false,
            errorMessage: message.errorMessage,
          })
        }
        if (message.errorMessage) {
          record.run.lastError = message.errorMessage
          record.run.status = 'failed'
          this.emit({ type: 'error', runId, message: message.errorMessage })
        }
        record.run.updatedAt = this.now()
        this.emitRunUpdated(record.run)
        return
      }
      case 'tool_execution_start': {
        const tool: AgentToolActivityEntry = {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          startedAt: this.now(),
          args: event.args,
        }
        record.run.toolActivity.push(tool)
        record.run.updatedAt = this.now()
        this.emit({ type: 'tool-activity', runId, tool })
        this.emitRunUpdated(record.run)
        return
      }
      case 'tool_execution_end': {
        const tool = record.run.toolActivity.find((entry) => entry.toolCallId === event.toolCallId)
        if (tool) {
          tool.completedAt = this.now()
          tool.result = event.result
          tool.isError = event.isError
          this.emit({ type: 'tool-activity', runId, tool })
          record.run.updatedAt = this.now()
          this.emitRunUpdated(record.run)
        }
        return
      }
      case 'compaction_start':
      case 'compaction_end':
      case 'auto_retry_start':
      case 'auto_retry_end':
      case 'message_start':
      case 'tool_execution_update':
      case 'turn_start':
      case 'turn_end':
        return
      default:
        return
    }
  }

  private requireRun(runId: string): RunRecord {
    const record = this.runs.get(runId)
    if (!record) throw new Error(`Run ${runId} was not found.`)
    return record
  }

  private getLatestRun(): AgentRunState | undefined {
    const latestRunId = this.runOrder[0]
    return latestRunId ? this.runs.get(latestRunId)?.run : undefined
  }

  private emit(event: AgentRunEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  private emitRunUpdated(run: AgentRunState): void {
    this.emit({ type: 'run-updated', run })
  }

  private toPanelStatus(status: AgentRunState['status']): AgentPanelState['status'] {
    switch (status) {
      case 'queued':
      case 'starting':
        return 'connecting'
      case 'running':
        return 'running'
      case 'completed':
        return 'ready'
      case 'failed':
      case 'aborted':
        return 'error'
    }
  }
}

export function toLegacyPanelEvent(event: AgentRunEvent): AgentPanelEvent | undefined {
  switch (event.type) {
    case 'run-created':
    case 'run-updated':
      return {
        type: 'agent-state',
        state: {
          status: event.run.status === 'running' ? 'running' : event.run.status === 'failed' || event.run.status === 'aborted' ? 'error' : event.run.status === 'completed' ? 'ready' : 'connecting',
          sessionId: event.run.sessionId,
          sessionFile: event.run.sessionFile,
          model: event.run.model,
          selectedTicketId: event.run.ticket.ticketId,
          lastError: event.run.lastError,
          isStreaming: event.run.status === 'running' || event.run.status === 'starting',
          queuedSteeringCount: event.run.queuedSteeringCount,
          queuedFollowUpCount: event.run.queuedFollowUpCount,
        },
      }
    case 'run-output':
      if (event.entry.role === 'assistant' && event.entry.isStreaming) {
        return {
          type: 'assistant-text-delta',
          timestamp: event.entry.timestamp,
          delta: event.entry.text,
        }
      }
      if (event.entry.role === 'assistant') {
        return {
          type: 'assistant-message-complete',
          timestamp: event.entry.timestamp,
          text: event.entry.text,
          errorMessage: event.entry.errorMessage,
        }
      }
      return undefined
    case 'tool-activity':
      if (event.tool.completedAt) {
        return {
          type: 'tool-end',
          toolCallId: event.tool.toolCallId,
          toolName: event.tool.toolName,
          result: event.tool.result,
          isError: Boolean(event.tool.isError),
        }
      }
      return {
        type: 'tool-start',
        toolCallId: event.tool.toolCallId,
        toolName: event.tool.toolName,
        args: event.tool.args,
      }
    case 'error':
      return { type: 'error', message: event.message }
  }
}
