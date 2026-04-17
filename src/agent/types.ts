export type AgentPanelStatus = 'idle' | 'connecting' | 'ready' | 'running' | 'error'

export type SelectedTicketContext = {
  ticketId: string
  title: string
  body: string
  filePath: string
}

export type AgentPanelState = {
  status: AgentPanelStatus
  sessionId?: string
  sessionFile?: string
  model?: {
    provider: string
    id: string
  }
  selectedTicketId?: string
  lastError?: string
  isStreaming: boolean
  queuedSteeringCount: number
  queuedFollowUpCount: number
}

export type AgentPanelEvent =
  | { type: 'ready'; state: AgentPanelState }
  | { type: 'agent-state'; state: AgentPanelState }
  | { type: 'assistant-text-delta'; timestamp: number; delta: string }
  | {
      type: 'assistant-message-complete'
      timestamp: number
      text: string
      stopReason?: string
      errorMessage?: string
    }
  | {
      type: 'tool-start'
      toolCallId: string
      toolName: string
      args: unknown
    }
  | {
      type: 'tool-end'
      toolCallId: string
      toolName: string
      result: unknown
      isError: boolean
    }
  | {
      type: 'queue-update'
      steeringCount: number
      followUpCount: number
    }
  | {
      type: 'error'
      message: string
    }
