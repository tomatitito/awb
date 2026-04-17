import type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent'
import type { AssistantMessage } from '@mariozechner/pi-ai'
import type { AgentPanelEvent, AgentPanelState, SelectedTicketContext } from './types.js'
import { createPiSession } from './createPiSession.js'

export class AgentController {
  private readonly listeners = new Set<(event: AgentPanelEvent) => void>()
  private session?: AgentSession
  private unsubscribeSession?: () => void
  private selectedTicket?: SelectedTicketContext
  private starting?: Promise<void>
  private state: AgentPanelState = {
    status: 'idle',
    isStreaming: false,
    queuedSteeringCount: 0,
    queuedFollowUpCount: 0,
  }

  constructor(private readonly projectDir: string) {}

  getState(): AgentPanelState {
    return this.state
  }

  subscribe(listener: (event: AgentPanelEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async ensureStarted(): Promise<void> {
    if (this.session) return
    if (this.starting) return this.starting

    this.updateState({ status: 'connecting', lastError: undefined })
    this.starting = (async () => {
      try {
        const { session } = await createPiSession(this.projectDir)
        this.session = session
        this.unsubscribeSession = session.subscribe((event) => {
          this.handleSessionEvent(event)
        })
        this.refreshState('ready')
        this.emit({ type: 'ready', state: this.state })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.updateState({
          status: 'error',
          lastError: message,
          isStreaming: false,
        })
        this.emit({ type: 'error', message })
      } finally {
        this.starting = undefined
      }
    })()

    return this.starting
  }

  setSelectedTicket(ticket: SelectedTicketContext | undefined): void {
    this.selectedTicket = ticket
    this.updateState({ selectedTicketId: ticket?.ticketId })
  }

  async prompt(text: string): Promise<void> {
    await this.ensureStarted()
    if (!this.session) {
      throw new Error(this.state.lastError || 'pi session is unavailable')
    }
    if (this.session.isStreaming) {
      throw new Error('The agent is already running. Abort the current run before sending another prompt.')
    }

    const fullPrompt = this.buildPrompt(text)
    this.updateState({ lastError: undefined, status: 'ready' })
    void this.session.prompt(fullPrompt).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      this.updateState({ status: 'error', lastError: message, isStreaming: false })
      this.emit({ type: 'error', message })
    })
  }

  async abort(): Promise<void> {
    await this.ensureStarted()
    if (!this.session) return
    await this.session.abort()
    this.refreshState(this.state.lastError ? 'error' : 'ready', { isStreaming: false })
  }

  dispose(): void {
    this.unsubscribeSession?.()
    this.unsubscribeSession = undefined
    this.session?.dispose()
    this.session = undefined
  }

  private emit(event: AgentPanelEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  private updateState(partial: Partial<AgentPanelState>): void {
    this.state = {
      ...this.state,
      ...partial,
    }
    this.emit({ type: 'agent-state', state: this.state })
  }

  private refreshState(
    statusOverride?: AgentPanelState['status'],
    stateOverride: Partial<AgentPanelState> = {},
  ): void {
    const session = this.session
    if (!session) return

    const isStreaming = stateOverride.isStreaming ?? session.isStreaming
    const model = session.model
    this.updateState({
      status: statusOverride ?? (isStreaming ? 'running' : this.state.lastError ? 'error' : 'ready'),
      sessionId: session.sessionId,
      sessionFile: session.sessionFile,
      model: model ? { provider: model.provider, id: model.id } : undefined,
      selectedTicketId: this.selectedTicket?.ticketId,
      isStreaming,
      ...stateOverride,
    })
  }

  private handleSessionEvent(event: AgentSessionEvent): void {
    switch (event.type) {
      case 'agent_start':
        this.refreshState('running', { isStreaming: true })
        return
      case 'agent_end':
        this.refreshState(this.state.lastError ? 'error' : 'ready', { isStreaming: false })
        return
      case 'queue_update':
        this.updateState({
          queuedSteeringCount: event.steering.length,
          queuedFollowUpCount: event.followUp.length,
        })
        this.emit({
          type: 'queue-update',
          steeringCount: event.steering.length,
          followUpCount: event.followUp.length,
        })
        return
      case 'message_update':
        if (event.assistantMessageEvent.type === 'text_delta') {
          this.emit({
            type: 'assistant-text-delta',
            timestamp: event.message.timestamp,
            delta: event.assistantMessageEvent.delta,
          })
        }
        return
      case 'message_end':
        if (event.message.role === 'assistant') {
          const message = event.message as AssistantMessage
          const text = message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('')
          this.emit({
            type: 'assistant-message-complete',
            timestamp: message.timestamp,
            text,
            stopReason: message.stopReason,
            errorMessage: message.errorMessage,
          })
          if (message.errorMessage) {
            this.updateState({ status: 'error', lastError: message.errorMessage })
            this.emit({ type: 'error', message: message.errorMessage })
          }
        }
        return
      case 'tool_execution_start':
        this.emit({
          type: 'tool-start',
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        })
        return
      case 'tool_execution_end':
        this.emit({
          type: 'tool-end',
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: event.result,
          isError: event.isError,
        })
        return
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

  private buildPrompt(text: string): string {
    const userText = text.trim()
    if (!this.selectedTicket) return userText

    return [
      'You are working inside AWB.',
      '',
      'Selected ticket:',
      `- id: ${this.selectedTicket.ticketId}`,
      `- title: ${this.selectedTicket.title}`,
      `- file: ${this.selectedTicket.filePath}`,
      '',
      'Ticket body:',
      this.selectedTicket.body || '(empty)',
      '',
      'User request:',
      userText,
    ].join('\n')
  }
}
