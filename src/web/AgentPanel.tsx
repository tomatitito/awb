import type { DerivedTicket } from '../core/types'

type TabKey = 'graph' | 'kanban' | 'details'

export function AgentPanel({
  ticket,
  tab,
  ticketCount,
}: {
  ticket?: DerivedTicket
  tab: TabKey
  ticketCount: number
}) {
  return (
    <aside className="agent-panel" aria-label="Agent panel">
      <div className="agent-panel-header">
        <div>
          <strong>Agent panel</strong>
          <div className="agent-panel-subtitle">Reserved for pi-powered workflow assistance.</div>
        </div>
        <span className="badge tag">preview</span>
      </div>

      <div className="agent-panel-section-grid">
        <div>
          <strong>Current view</strong>
          <span>{tab}</span>
        </div>
        <div>
          <strong>Visible tickets</strong>
          <span>{ticketCount}</span>
        </div>
        <div>
          <strong>Selected ticket</strong>
          <span>{ticket?.id ?? '—'}</span>
        </div>
      </div>

      <section className="agent-panel-section">
        <strong>Context</strong>
        {ticket ? (
          <>
            <div className="agent-panel-ticket-title">{ticket.title}</div>
            <div className="agent-panel-ticket-meta">
              <span className="badge tag">{ticket.status || 'unknown'}</span>
              {ticket.priority !== undefined ? <span>P{ticket.priority}</span> : null}
              {ticket.parent ? <span>epic {ticket.parent}</span> : null}
            </div>
            <p className="agent-panel-copy">
              The panel is open and wired into the app layout. pi SDK session embedding and workflow actions land in follow-up tickets.
            </p>
          </>
        ) : (
          <p className="agent-panel-copy">
            Select a ticket to expose its context here once the interactive agent integration is added.
          </p>
        )}
      </section>
    </aside>
  )
}
