import { useMemo, useState } from 'react'

const PAUSE_UNAVAILABLE_REASON = 'Pause is not yet supported by the current agent runtime. Closing the panel will keep the current run active.'
import type { DerivedTicket } from '../core/types'
import type { AgentPanelState } from '../agent/types'
import type { AgentTranscriptEntry, ToolActivityEntry } from './useAgentPanel'

function formatStatusLabel(status: AgentPanelState['status']): string {
  switch (status) {
    case 'connecting':
      return 'connecting'
    case 'ready':
      return 'ready'
    case 'running':
      return 'running'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function AgentPanel({
  ticket,
  state,
  transcript,
  toolActivity,
  onSendPrompt,
  onAbort,
}: {
  ticket?: DerivedTicket
  state: AgentPanelState
  transcript: AgentTranscriptEntry[]
  toolActivity: ToolActivityEntry[]
  onSendPrompt: (text: string) => Promise<void>
  onAbort: () => Promise<void>
}) {
  const [promptText, setPromptText] = useState('Implement the selected ticket.')
  const [actionError, setActionError] = useState<string | undefined>()
  const toolSummary = useMemo(() => toolActivity.slice(-6).reverse(), [toolActivity])

  return (
    <aside className="agent-panel" aria-label="Agent panel">
      <div className="agent-panel-header">
        <div>
          <strong>Agent panel</strong>
          <div className="agent-panel-subtitle">pi SDK session embedded in the awb server.</div>
        </div>
        <span className={`badge agent-status agent-status-${state.status}`}>{formatStatusLabel(state.status)}</span>
      </div>

      <div className="agent-panel-section-grid">
        <div>
          <strong>Model</strong>
          <span>{state.model ? `${state.model.provider}/${state.model.id}` : '—'}</span>
        </div>
        <div>
          <strong>Session</strong>
          <span>{state.sessionId ? state.sessionId.slice(0, 12) : '—'}</span>
        </div>
        <div>
          <strong>Queue</strong>
          <span>{state.queuedSteeringCount + state.queuedFollowUpCount}</span>
        </div>
      </div>

      <section className="agent-panel-section">
        <strong>Context</strong>
        {ticket ? (
          <>
            <div className="agent-panel-ticket-title">{ticket.id} — {ticket.title}</div>
            <div className="agent-panel-ticket-meta">
              <span className="badge tag">{ticket.status || 'unknown'}</span>
              {ticket.priority !== undefined ? <span>P{ticket.priority}</span> : null}
              <span>{ticket.filePath}</span>
            </div>
          </>
        ) : (
          <p className="agent-panel-copy">Select a ticket to seed the server-side prompt context.</p>
        )}
        {state.lastError || actionError ? <div className="agent-panel-error">{actionError || state.lastError}</div> : null}
      </section>

      <section className="agent-panel-section">
        <strong>Transcript</strong>
        <div className="agent-transcript">
          {transcript.length === 0 ? <div className="empty-inline">No agent output yet.</div> : null}
          {transcript.map((entry) => (
            <article key={entry.id} className={`agent-transcript-entry ${entry.kind}`}>
              <div className="agent-transcript-entry-top">
                <span>{entry.kind === 'assistant' ? 'assistant' : 'error'}</span>
                <span>{formatTime(entry.timestamp)}</span>
              </div>
              <pre>{entry.text || (entry.kind === 'assistant' && entry.isStreaming ? '…' : '')}</pre>
              {entry.kind === 'assistant' && entry.errorMessage ? <div className="agent-panel-error">{entry.errorMessage}</div> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="agent-panel-section">
        <strong>Tool activity</strong>
        <div className="agent-tool-list">
          {toolSummary.length === 0 ? <div className="empty-inline">No tool calls yet.</div> : null}
          {toolSummary.map((tool) => (
            <div key={tool.toolCallId} className="agent-tool-item">
              <div className="agent-tool-item-top">
                <span>{tool.toolName}</span>
                <span>{tool.completedAt ? (tool.isError ? 'error' : 'done') : 'running'}</span>
              </div>
              {tool.preview ? <code>{tool.preview}</code> : null}
            </div>
          ))}
        </div>
      </section>

      <form
        className="agent-composer"
        onSubmit={(event) => {
          event.preventDefault()
          const text = promptText.trim()
          if (!text) return
          setActionError(undefined)
          void onSendPrompt(text).catch((error) => {
            setActionError(error instanceof Error ? error.message : String(error))
          })
        }}
      >
        <strong>Prompt</strong>
        <textarea
          value={promptText}
          onChange={(event) => setPromptText(event.target.value)}
          placeholder="Ask the agent what to do next"
          rows={5}
        />
        <div className="agent-run-controls" aria-label="Agent execution controls">
          <button type="submit" className="primary-button" disabled={state.status === 'connecting' || state.isStreaming}>
            Send
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!state.isStreaming}
            onClick={() => {
              setActionError(undefined)
              void onAbort().catch((error) => {
                setActionError(error instanceof Error ? error.message : String(error))
              })
            }}
          >
            Stop
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled
            title={PAUSE_UNAVAILABLE_REASON}
            aria-disabled="true"
          >
            Pause
          </button>
        </div>
        <div className="agent-composer-note">{PAUSE_UNAVAILABLE_REASON}</div>
      </form>
    </aside>
  )
}
