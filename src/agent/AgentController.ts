import fs from 'node:fs'
import type { AssistantMessage } from '@mariozechner/pi-ai'
import type { AgentSession, AgentSessionEvent, ModelRegistry } from '@mariozechner/pi-coding-agent'
import { openPathInEditor } from '../editor.js'
import type { CredentialProvider, createPiSession } from './createPiSession.js'
import type { LoginController } from './LoginController.js'
import type { AgentRunStorage } from './runStorage.js'
import type {
  AgentAuthProviderState,
  AgentLoginFlowState,
  AgentPanelEvent,
  AgentPanelState,
  AgentRunEvent,
  AgentRunResumeHealth,
  AgentRunState,
  AgentRunWorktreeState,
  AgentToolActivityEntry,
  SelectedTicketContext,
  TicketRunContext,
  UnticketedRunContext,
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
  runStorage?: AgentRunStorage
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
  private readonly runStorage?: AgentRunStorage
  private readonly runs = new Map<string, RunRecord>()
  private runOrder: string[] = []
  private selectedTicket?: SelectedTicketContext
  private hasReconciledStaleWorktrees = false
  private hasLoadedPersistedRuns = false

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
    this.runStorage = options.runStorage
  }

  async ensureStarted(): Promise<void> {
    if (!this.hasLoadedPersistedRuns) {
      const result = this.runStorage?.load()
      if (result) {
        for (const warning of result.warnings) console.warn(`awb: ${warning}`)
        for (const run of result.runs) {
          if (!this.runs.has(run.id)) this.runs.set(run.id, { run })
        }
        const liveRunIds = this.runOrder.filter((runId) => this.runs.has(runId))
        const loadedRunIds = result.runs.map((run) => run.id).filter((runId) => !liveRunIds.includes(runId))
        this.runOrder = [...liveRunIds, ...loadedRunIds]
      }
      this.hasLoadedPersistedRuns = true
    }
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
      selectedTicketId: this.selectedTicket?.ticketId ?? (latestRun.context.kind === 'ticket' ? latestRun.context.ticketId : undefined),
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

  async createRun(ticket: SelectedTicketContext): Promise<AgentRunState> {
    const runId = this.createRunId()
    const createdAt = this.now()
    const context: TicketRunContext = {
      kind: 'ticket',
      ticketId: ticket.ticketId,
      title: ticket.title,
      body: ticket.body,
      filePath: ticket.filePath,
    }
    const initialPrompt = this.buildInitialPrompt(context)
    const run: AgentRunState = {
      id: runId,
      context,
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
    this.persistRun(run)
    this.emit({ type: 'run-created', run })
    void this.startRun(runId)
    return run
  }

  async createUnticketedRun(firstPrompt: string): Promise<AgentRunState> {
    const userText = firstPrompt.trim()
    if (!userText) throw new Error('Prompt text is required.')

    const runId = this.createRunId()
    const createdAt = this.now()
    const context: UnticketedRunContext = {
      kind: 'unticketed',
      title: this.buildUnticketedRunTitle(userText),
    }
    const run: AgentRunState = {
      id: runId,
      context,
      status: 'queued',
      createdAt,
      updatedAt: createdAt,
      transcript: {
        runId,
        initialPrompt: userText,
        entries: [
          {
            id: `${runId}:user:initial`,
            role: 'user',
            text: userText,
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
    this.persistRun(run)
    this.emit({ type: 'run-created', run })
    void this.startRun(runId)
    return run
  }

  async promptRun(runId: string, text: string): Promise<void> {
    const userText = text.trim()
    if (!userText) throw new Error('Prompt text is required.')

    const record = this.requireRun(runId)
    if (record.run.status === 'failed') throw new Error(`Run ${runId} has failed and cannot accept follow-up prompts.`)
    if (record.run.status === 'aborted') throw new Error(`Run ${runId} has been aborted and cannot accept follow-up prompts.`)
    if (!record.session && (record.run.status === 'queued' || record.run.status === 'starting' || record.run.status === 'running')) {
      throw new Error(`Run ${runId} is not ready for follow-up prompts yet.`)
    }
    if (!record.session) await this.reopenRunSession(record)
    const session = record.session
    if (!session) throw new Error(`Run ${runId} is not ready for follow-up prompts yet.`)

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
    await session.prompt(userText)
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

  async closeUnticketedRun(runId: string): Promise<AgentRunState> {
    const record = this.requireRun(runId)
    if (record.run.context.kind !== 'unticketed') {
      throw new Error(`Run ${runId} is ticket-backed and cannot be closed as an unticketed chat.`)
    }

    if (record.run.status === 'closed') return record.run

    if (record.run.status === 'running' || record.run.status === 'starting') {
      await record.session?.abort()
    }

    record.unsubscribeSession?.()
    record.unsubscribeSession = undefined
    record.session?.dispose()
    record.session = undefined

    const timestamp = this.now()
    record.run.status = 'closed'
    record.run.closedAt = timestamp
    record.run.updatedAt = timestamp
    record.run.transcript.updatedAt = timestamp
    this.emitRunUpdated(record.run)
    return record.run
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

  private buildUnticketedRunTitle(firstPrompt: string): string {
    const normalized = firstPrompt.replace(/\s+/g, ' ').trim()
    if (!normalized) return 'Unticketed agent chat'
    return normalized.length > 72 ? `${normalized.slice(0, 69)}…` : normalized
  }

  private async startRun(runId: string): Promise<void> {
    const record = this.requireRun(runId)
    if (this.isRunClosed(record)) return
    const startedAt = this.now()
    record.run.status = 'starting'
    record.run.startedAt = startedAt
    record.run.updatedAt = startedAt
    this.emitRunUpdated(record.run)

    try {
      this.modelRegistry.refresh()
      if (this.worktreeManager?.enabled) {
        record.run.worktree = await this.worktreeManager.provision(runId)
        if (this.isRunClosed(record)) return
        record.run.updatedAt = this.now()
        record.run.transcript.updatedAt = record.run.updatedAt
        this.emitRunUpdated(record.run)
      }
      const cwd = this.getRunCwd(record.run)
      const { session } = await this.createSession(this.projectDir, {
        cwd,
        credentialProvider: this.credentialProvider,
        modelRegistry: this.modelRegistry,
      })
      if (this.isRunClosed(record)) {
        session.dispose()
        return
      }
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
      if (this.isRunClosed(record)) return
      await session.prompt(record.run.transcript.initialPrompt)
    } catch (error) {
      if (this.isRunClosed(record)) return
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
    for (const e of events) {
      if (e.type === 'run-updated') this.persistRun(e.run)
      this.emit(e)
    }
    if (record.run.status === 'failed') {
      void this.cleanupRunWorktreeRecord(record, true)
    }
  }

  private async reopenRunSession(record: RunRecord): Promise<void> {
    const health = this.computeResumeHealth(record.run)
    record.run.resume = health
    if (health.state !== 'available') {
      this.emitRunUpdated(record.run)
      throw new Error(`Run ${record.run.id} cannot be resumed: ${this.describeResumeHealth(health)}`)
    }

    const cwd = this.getRunCwd(record.run)
    try {
      const { session } = await this.createSession(this.projectDir, {
        cwd,
        sessionFile: record.run.sessionFile,
        credentialProvider: this.credentialProvider,
        modelRegistry: this.modelRegistry,
      })
      record.session = session
      record.unsubscribeSession = session.subscribe((event) => {
        this.handleSessionEvent(record.run.id, event)
      })
      record.run.sessionId = session.sessionId
      record.run.sessionFile = session.sessionFile
      record.run.model = session.model ? { provider: session.model.provider, id: session.model.id } : undefined
      record.run.resume = { state: 'available', lastCheckedAt: this.now(), error: null }
      record.run.updatedAt = this.now()
      record.run.transcript.updatedAt = record.run.updatedAt
      this.emitRunUpdated(record.run)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      record.run.resume = {
        state: 'invalid-session-file',
        lastCheckedAt: this.now(),
        error: message,
      }
      record.run.updatedAt = this.now()
      record.run.transcript.updatedAt = record.run.updatedAt
      this.emitRunUpdated(record.run)
      throw new Error(`Run ${record.run.id} cannot be resumed: invalid pi session file. ${message}`)
    }
  }

  private computeResumeHealth(run: AgentRunState): AgentRunResumeHealth {
    const checkedAt = this.now()
    if (run.worktree?.mode === 'git-worktree') {
      if (run.worktree.status === 'cleaned') {
        return { state: 'worktree-cleaned', lastCheckedAt: checkedAt, error: `Worktree for run ${run.id} was cleaned.` }
      }
      if (!run.worktree.path) {
        return { state: 'worktree-missing', lastCheckedAt: checkedAt, error: `Run ${run.id} does not record a retained worktree path.` }
      }
      if (!fs.existsSync(run.worktree.path)) {
        return { state: 'worktree-missing', lastCheckedAt: checkedAt, error: `Worktree path ${run.worktree.path} does not exist.` }
      }
      if (run.worktree.status !== 'ready') {
        return { state: 'worktree-missing', lastCheckedAt: checkedAt, error: `Worktree for run ${run.id} is ${run.worktree.status}.` }
      }
    }

    if (!run.sessionFile) return { state: 'not-started', lastCheckedAt: checkedAt, error: 'No pi session file was recorded.' }
    if (!fs.existsSync(run.sessionFile)) {
      return { state: 'missing-session-file', lastCheckedAt: checkedAt, error: `Session file ${run.sessionFile} does not exist.` }
    }
    return { state: 'available', lastCheckedAt: checkedAt, error: null }
  }

  private describeResumeHealth(health: AgentRunResumeHealth): string {
    if (health.error) return health.error
    switch (health.state) {
      case 'available':
        return 'resume health is available.'
      case 'not-started':
        return 'no pi session file was recorded.'
      case 'missing-session-file':
        return 'the pi session file is missing.'
      case 'invalid-session-file':
        return 'the pi session file is invalid.'
      case 'cwd-mismatch':
        return 'the recorded session cwd does not match the run cwd.'
      case 'worktree-missing':
        return 'the retained worktree is missing.'
      case 'worktree-cleaned':
        return 'the retained worktree was cleaned.'
    }
  }

  private getRunCwd(run: AgentRunState): string {
    if (run.worktree?.mode === 'git-worktree') {
      if (!run.worktree.path) throw new Error(`Run ${run.id} does not record a retained worktree path.`)
      return run.worktree.path
    }
    return this.projectDir
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

  private isRunClosed(record: RunRecord): boolean {
    return record.run.status === 'closed'
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
    this.persistRun(run)
    this.emit({ type: 'run-updated', run })
  }

  private persistRun(run: AgentRunState): void {
    try {
      this.runStorage?.save(run)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`awb: failed to persist agent run ${run.id}: ${message}`)
    }
  }

  private toPanelStatus(status: AgentRunState['status']): AgentPanelState['status'] {
    switch (status) {
      case 'queued':
      case 'starting':
        return 'connecting'
      case 'running':
        return 'running'
      case 'waiting':
      case 'completed':
      case 'closed':
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
      const timestamp = now()
      run.status = 'running'
      run.startedAt = timestamp
      run.completedAt = undefined
      run.closedAt = undefined
      run.updatedAt = timestamp
      return [{ type: 'run-updated', run }]
    }
    case 'agent_end': {
      const timestamp = now()
      if (run.status !== 'aborted' && run.status !== 'failed') {
        if (run.lastError) {
          run.status = 'failed'
          run.completedAt = timestamp
        } else if (run.context.kind === 'unticketed') {
          run.status = 'waiting'
          run.completedAt = undefined
        } else {
          run.status = 'completed'
          run.completedAt = timestamp
        }
      } else {
        run.completedAt ??= timestamp
      }
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
                : event.run.status === 'completed' || event.run.status === 'waiting' || event.run.status === 'closed'
                  ? 'ready'
                  : 'connecting',
          sessionId: event.run.sessionId,
          sessionFile: event.run.sessionFile,
          model: event.run.model,
          selectedTicketId: event.run.context.kind === 'ticket' ? event.run.context.ticketId : undefined,
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
