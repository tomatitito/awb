import type { AssistantMessage } from '@mariozechner/pi-ai'
import type { AgentSession, AgentSessionEvent, ModelRegistry } from '@mariozechner/pi-coding-agent'
import { openPathInEditor } from '../editor.js'
import type { CredentialProvider, createPiSession } from './createPiSession.js'
import type { LoginController } from './LoginController.js'
import type {
  AgentAuthProviderState,
  AgentLoginFlowState,
  AgentPanelEvent,
  AgentPanelState,
  AgentRunEvent,
  AgentRunState,
  AgentRunWorktreeState,
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

type WorktreeManager = {
  enabled: boolean
  reconcileStaleWorktrees: () => Promise<void>
  provision: (runId: string) => Promise<AgentRunWorktreeState>
  cleanup: (worktree: AgentRunWorktreeState, options: { removeBranch: boolean }) => Promise<AgentRunWorktreeState>
}

type AgentControllerOptions = {
  createSession: SessionFactory
  createRunId: () => string
  now: () => number
  loginController: LoginController
  credentialProvider: CredentialProvider
  modelRegistry: ModelRegistry
  worktreeManager?: WorktreeManager
  editorCommand?: string
}

export class AgentController {
  private readonly listeners = new Set<(event: AgentRunEvent) => void>()
  private readonly createSession: SessionFactory
  private readonly createRunId: () => string
  private readonly now: () => number
  private readonly loginController: LoginController
  private readonly credentialProvider: CredentialProvider
  private readonly modelRegistry: ModelRegistry
  private readonly worktreeManager?: WorktreeManager
  private readonly editorCommand?: string
  private readonly runs = new Map<string, RunRecord>()
  private runOrder: string[] = []
  private selectedTicket?: SelectedTicketContext
  private hasReconciledStaleWorktrees = false

  constructor(
    private readonly projectDir: string,
    options: AgentControllerOptions,
  ) {
    this.createSession = options.createSession
    this.createRunId = options.createRunId
    this.now = options.now
    this.loginController = options.loginController
    this.credentialProvider = options.credentialProvider
    this.modelRegistry = options.modelRegistry
    this.worktreeManager = options.worktreeManager
    this.editorCommand = options.editorCommand
  }

  async ensureStarted(): Promise<void> {
    this.modelRegistry.refresh()
    if (!this.hasReconciledStaleWorktrees) {
      await this.worktreeManager?.reconcileStaleWorktrees()
      this.hasReconciledStaleWorktrees = true
    }
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
        authProviders: this.getAuthProviders(),
        loginFlow: this.loginController.getLoginFlow(),
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
      authProviders: this.getAuthProviders(),
      loginFlow: this.loginController.getLoginFlow(),
    }
  }

  getAuthProviders(): AgentAuthProviderState[] {
    return this.loginController.getAuthProviders()
  }

  async startLogin(providerId: string): Promise<AgentLoginFlowState> {
    return this.loginController.startLogin(providerId)
  }

  getLoginFlow(): AgentLoginFlowState | undefined {
    return this.loginController.getLoginFlow()
  }

  async submitLoginInput(value: string): Promise<void> {
    return this.loginController.submitLoginInput(value)
  }

  async cancelLogin(): Promise<void> {
    return this.loginController.cancelLogin()
  }

  subscribe(listener: (event: AgentRunEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  listRuns(): AgentRunState[] {
    return this.runOrder.map((runId) => this.runs.get(runId)?.run).filter((run): run is AgentRunState => Boolean(run))
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
      transcript: {
        runId,
        initialPrompt,
        entries: [
          {
            id: `${runId}:user:initial`,
            role: 'user',
            text: initialPrompt,
            timestamp: createdAt,
          },
        ],
        toolActivity: [],
        updatedAt: createdAt,
      },
      queuedSteeringCount: 0,
      queuedFollowUpCount: 0,
      worktree: this.worktreeManager?.enabled
        ? {
            mode: 'git-worktree',
            status: 'provisioning',
          }
        : {
            mode: 'shared-project',
            status: 'not-requested',
          },
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
    record.run.transcript.entries.push({
      id: `${runId}:user:${timestamp}`,
      role: 'user',
      text: userText,
      timestamp,
    })
    record.run.updatedAt = timestamp
    record.run.transcript.updatedAt = timestamp
    const entry = record.run.transcript.entries[record.run.transcript.entries.length - 1]
    if (!entry) throw new Error(`Run ${runId} is missing the newly added transcript entry.`)
    this.emit({
      type: 'run-output',
      runId,
      entry,
    })
    this.emitRunUpdated(record.run)
    await record.session.prompt(userText)
  }

  async openRunWorktreeInEditor(runId: string): Promise<void> {
    const record = this.requireRun(runId)
    const worktreePath = record.run.worktree?.path
    if (!worktreePath || record.run.worktree?.status !== 'ready') {
      throw new Error(`Run ${runId} does not have a retained worktree to open.`)
    }
    await openPathInEditor(this.editorCommand, worktreePath)
  }

  async cleanupRunWorktree(runId: string): Promise<AgentRunState> {
    const record = this.requireRun(runId)
    if (!record.run.worktree || record.run.worktree.mode !== 'git-worktree') {
      throw new Error(`Run ${runId} does not use a dedicated worktree.`)
    }
    record.run.worktree = {
      ...record.run.worktree,
      status: 'cleanup-pending',
      cleanupStartedAt: this.now(),
    }
    this.emitRunUpdated(record.run)
    await this.cleanupRunWorktreeRecord(record, record.run.status === 'failed')
    return record.run
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
    void this.loginController.cancelLogin()
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
      this.modelRegistry.refresh()
      if (this.worktreeManager?.enabled) {
        record.run.worktree = await this.worktreeManager.provision(runId)
        record.run.updatedAt = this.now()
        record.run.transcript.updatedAt = record.run.updatedAt
        this.emitRunUpdated(record.run)
      }
      const cwd = record.run.worktree?.mode === 'git-worktree' && record.run.worktree.path ? record.run.worktree.path : this.projectDir
      const { session } = await this.createSession(this.projectDir, {
        cwd,
        credentialProvider: this.credentialProvider,
        modelRegistry: this.modelRegistry,
      })
      record.session = session
      record.unsubscribeSession = session.subscribe((event) => {
        this.handleSessionEvent(runId, event)
      })
      record.run.sessionId = session.sessionId
      record.run.sessionFile = session.sessionFile
      record.run.model = session.model ? { provider: session.model.provider, id: session.model.id } : undefined
      record.run.updatedAt = this.now()
      record.run.transcript.updatedAt = record.run.updatedAt
      this.emitRunUpdated(record.run)
      await session.prompt(record.run.transcript.initialPrompt)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const timestamp = this.now()
      record.run.status = 'failed'
      record.run.completedAt = timestamp
      record.run.updatedAt = timestamp
      record.run.lastError = message
      if (record.run.worktree?.mode === 'git-worktree') {
        record.run.worktree = {
          ...record.run.worktree,
          status: 'failed',
          cleanupError: message,
          lastCheckedAt: timestamp,
        }
      }
      record.run.transcript.entries.push({
        id: `${runId}:error:${timestamp}`,
        role: 'error',
        text: message,
        timestamp,
        errorMessage: message,
      })
      record.run.transcript.updatedAt = timestamp
      this.emit({ type: 'error', runId, message })
      this.emitRunUpdated(record.run)
      await this.cleanupRunWorktreeRecord(record, true)
    }
  }

  private handleSessionEvent(runId: string, event: AgentSessionEvent): void {
    const record = this.runs.get(runId)
    if (!record) return
    const events = applySessionEvent(record.run, event, this.now)
    for (const e of events) this.emit(e)
    if (record.run.status === 'failed') {
      void this.cleanupRunWorktreeRecord(record, true)
    }
  }

  private async cleanupRunWorktreeRecord(record: RunRecord, removeBranch: boolean): Promise<void> {
    if (!this.worktreeManager || !record.run.worktree || record.run.worktree.mode !== 'git-worktree') return
    if (record.run.worktree.status === 'cleaned' || record.run.worktree.status === 'cleaning') return
    record.run.worktree = await this.worktreeManager.cleanup(record.run.worktree, { removeBranch })
    record.run.updatedAt = this.now()
    this.emitRunUpdated(record.run)
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

export function applySessionEvent(run: AgentRunState, event: AgentSessionEvent, now: () => number): AgentRunEvent[] {
  const runId = run.id

  switch (event.type) {
    case 'agent_start': {
      run.status = 'running'
      run.updatedAt = now()
      return [{ type: 'run-updated', run }]
    }
    case 'agent_end': {
      const timestamp = now()
      if (run.status !== 'aborted' && run.status !== 'failed') {
        run.status = run.lastError ? 'failed' : 'completed'
      }
      run.completedAt ??= timestamp
      run.updatedAt = timestamp
      return [{ type: 'run-updated', run }]
    }
    case 'queue_update': {
      run.queuedSteeringCount = event.steering.length
      run.queuedFollowUpCount = event.followUp.length
      run.updatedAt = now()
      return [{ type: 'run-updated', run }]
    }
    case 'message_update': {
      if (event.assistantMessageEvent.type !== 'text_delta') return []
      const timestamp = event.message.timestamp
      const lastEntry = run.transcript.entries[run.transcript.entries.length - 1]
      if (lastEntry?.role === 'assistant' && lastEntry.isStreaming) {
        lastEntry.text = `${lastEntry.text}${event.assistantMessageEvent.delta}`
        lastEntry.timestamp = timestamp
        run.updatedAt = now()
        return [{ type: 'run-updated', run }]
      }

      const entry = {
        id: `${runId}:assistant:${timestamp}`,
        role: 'assistant' as const,
        text: event.assistantMessageEvent.delta,
        timestamp,
        isStreaming: true,
      }
      run.transcript.entries.push(entry)
      run.updatedAt = now()
      run.transcript.updatedAt = run.updatedAt
      return [
        { type: 'run-output', runId, entry },
        { type: 'run-updated', run },
      ]
    }
    case 'message_end': {
      if (event.message.role !== 'assistant') return []
      const message = event.message as AssistantMessage
      const text = message.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('')
      const timestamp = message.timestamp
      const lastEntry = run.transcript.entries[run.transcript.entries.length - 1]
      if (lastEntry?.role === 'assistant' && lastEntry.isStreaming) {
        lastEntry.text = text || lastEntry.text
        lastEntry.timestamp = timestamp
        lastEntry.isStreaming = false
        lastEntry.errorMessage = message.errorMessage
      } else {
        run.transcript.entries.push({
          id: `${runId}:assistant:${timestamp}`,
          role: 'assistant',
          text,
          timestamp,
          isStreaming: false,
          errorMessage: message.errorMessage,
        })
      }
      const events: AgentRunEvent[] = []
      if (message.errorMessage) {
        run.lastError = message.errorMessage
        run.status = 'failed'
        events.push({ type: 'error', runId, message: message.errorMessage })
      }
      run.updatedAt = now()
      run.transcript.updatedAt = run.updatedAt
      events.push({ type: 'run-updated', run })
      return events
    }
    case 'tool_execution_start': {
      const tool: AgentToolActivityEntry = {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        startedAt: now(),
        args: event.args,
      }
      run.transcript.toolActivity.push(tool)
      run.updatedAt = now()
      run.transcript.updatedAt = run.updatedAt
      return [
        { type: 'tool-activity', runId, tool },
        { type: 'run-updated', run },
      ]
    }
    case 'tool_execution_end': {
      const tool = run.transcript.toolActivity.find((entry) => entry.toolCallId === event.toolCallId)
      if (!tool) return []
      tool.completedAt = now()
      tool.result = event.result
      tool.isError = event.isError
      run.updatedAt = now()
      run.transcript.updatedAt = run.updatedAt
      return [
        { type: 'tool-activity', runId, tool },
        { type: 'run-updated', run },
      ]
    }
    default:
      return []
  }
}

export function toLegacyPanelEvent(event: AgentRunEvent): AgentPanelEvent | undefined {
  switch (event.type) {
    case 'run-created':
    case 'run-updated':
      return {
        type: 'agent-state',
        state: {
          status:
            event.run.status === 'running'
              ? 'running'
              : event.run.status === 'failed' || event.run.status === 'aborted'
                ? 'error'
                : event.run.status === 'completed'
                  ? 'ready'
                  : 'connecting',
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
