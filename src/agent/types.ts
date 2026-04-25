export type AgentPanelStatus = 'idle' | 'connecting' | 'ready' | 'running' | 'error'

export type TicketRunContext = {
  ticketId: string
  title: string
  body: string
  filePath: string
}

export type SelectedTicketContext = TicketRunContext

export type AgentRunStatus = 'queued' | 'starting' | 'running' | 'completed' | 'failed' | 'aborted'

export type AgentRunTranscriptEntry = {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  timestamp: number
  isStreaming?: boolean
  errorMessage?: string
}

export type AgentToolActivityEntry = {
  toolCallId: string
  toolName: string
  startedAt: number
  completedAt?: number
  args?: unknown
  result?: unknown
  isError?: boolean
}

export type AgentRunTranscript = {
  runId: string
  initialPrompt: string
  entries: AgentRunTranscriptEntry[]
  toolActivity: AgentToolActivityEntry[]
  updatedAt: number
}

export type AgentRunWorktreeState = {
  mode: 'shared-project' | 'git-worktree'
  status: 'not-requested' | 'provisioning' | 'ready' | 'cleanup-pending' | 'cleaning' | 'cleaned' | 'failed'
  path?: string
  branch?: string
  baseRef?: string
  headSha?: string
  createdAt?: number
  lastCheckedAt?: number
  cleanupStartedAt?: number
  cleanedAt?: number
  cleanupError?: string
}

export type AgentRunState = {
  id: string
  ticket: TicketRunContext
  status: AgentRunStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  abortedAt?: number
  updatedAt: number
  transcript: AgentRunTranscript
  queuedSteeringCount: number
  queuedFollowUpCount: number
  sessionId?: string
  sessionFile?: string
  model?: {
    provider: string
    id: string
  }
  lastError?: string
  worktree?: AgentRunWorktreeState
}

export type AgentRunEvent =
  | { type: 'run-created'; run: AgentRunState }
  | { type: 'run-updated'; run: AgentRunState }
  | { type: 'run-output'; runId: string; entry: AgentRunTranscriptEntry }
  | { type: 'tool-activity'; runId: string; tool: AgentToolActivityEntry }
  | { type: 'error'; runId: string; message: string }

export type AgentAuthProviderState = {
  id: string
  name: string
  usesCallbackServer: boolean
  isLoggedIn: boolean
  availableModelCount: number
  configuredModelCount: number
}

export type AgentLoginFlowState = {
  providerId: string
  providerName: string
  status: 'idle' | 'authorizing' | 'awaiting-input' | 'running' | 'completed' | 'failed' | 'cancelled'
  authUrl?: string
  instructions?: string
  prompt?: {
    message: string
    placeholder?: string
    allowEmpty?: boolean
    kind: 'prompt' | 'manual-code'
  }
  progressMessages: string[]
  error?: string
  completedAt?: number
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
  authProviders?: AgentAuthProviderState[]
  loginFlow?: AgentLoginFlowState
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
