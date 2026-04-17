import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { AppData, DerivedTicket } from '../core/types'
import { deriveVisibleGraph, type VisibleGraphDerivation } from '../core/graph'
import {
  createDefaultSidebarFilters,
  getAvailableStatuses,
  getEpicTickets,
  getVisibleTickets,
  normalizeFilterValue,
  type SidebarFilters,
} from './filtering'

type TabKey = 'graph' | 'kanban' | 'details'
type GraphDirection = 'lr' | 'tb'

const STATUS_ORDER = ['open', 'in progress', 'closed', 'todo', 'blocked', 'review']

const TOKENS = {
  accent: '#10a37f',
  accentDim: '#0d8c6d',
  border: '#5f87ff',
  borderAccent: '#10a37f',
  success: '#b5bd68',
  warning: '#f0c674',
  error: '#cc6666',
  muted: '#808080',
  dim: '#666666',
  text: '#e5e5e7',
  bodyBg: 'rgb(36, 37, 46)',
  containerBg: 'rgb(44, 45, 55)',
  selectedBg: '#3a3a4a',
  commentaryBg: '#2a2d3a',
} as const

function normalizeStatus(status?: string): string {
  return normalizeFilterValue(status)
}

function compareStatuses(a: string, b: string): number {
  const left = STATUS_ORDER.indexOf(normalizeStatus(a))
  const right = STATUS_ORDER.indexOf(normalizeStatus(b))
  if (left === -1 && right === -1) return a.localeCompare(b)
  if (left === -1) return 1
  if (right === -1) return -1
  return left - right
}

function matchesSearch(ticket: DerivedTicket, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return ticket.id.toLowerCase().includes(needle) || ticket.title.toLowerCase().includes(needle)
}

function summarizeTicketBody(body: string): string | undefined {
  const line = body
    .split('\n')
    .map((entry) => entry.trim())
    .find(Boolean)

  if (!line) return undefined

  const summary = line
    .replace(/^[#>*\-\s]+/, '')
    .replace(/`+/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[!*_~]/g, '')
    .trim()

  if (!summary) return undefined
  return summary.length > 140 ? `${summary.slice(0, 137)}…` : summary
}

function getTicketHoverText(ticket?: DerivedTicket): string | undefined {
  if (!ticket) return undefined
  return summarizeTicketBody(ticket.body) || ticket.title
}

function getEpicLabel(ticket: DerivedTicket, ticketById: Map<string, DerivedTicket>): string {
  if (normalizeFilterValue(ticket.type) === 'epic') return 'Epic'
  if (!ticket.parent) return ''
  const epic = ticketById.get(ticket.parent)
  return epic ? `Epic ${epic.id}` : `Epic ${ticket.parent}`
}

function StatusBadge({ ticket }: { ticket: DerivedTicket }) {
  const status = ticket.status || 'unknown'
  return <span className={`badge status-${normalizeStatus(status).replace(/\s+/g, '-')}`}>{status}</span>
}

function GraphEmptyState({ message }: { message: string }) {
  return <div className="graph-empty-state">{message}</div>
}

function GraphCycleState({ graph }: { graph: VisibleGraphDerivation }) {
  return (
    <div className="graph-empty-state graph-cycle-state">
      <strong>Dependency cycle detected</strong>
      <p>
        Layered ordering is unavailable because the dependency graph is not acyclic.
      </p>
      {graph.cycle ? (
        <>
          <div>Cycle path</div>
          <code>{graph.cycle.nodeIds.join(' → ')}</code>
        </>
      ) : null}
    </div>
  )
}

function GraphLegend({ showCriticalPath }: { showCriticalPath: boolean }) {
  return (
    <div className="graph-legend">
      <span><i className="swatch dep" /> direct dependency</span>
      {showCriticalPath ? <span><i className="swatch critical" /> critical path</span> : null}
      <span><i className="swatch related" /> selected related link</span>
    </div>
  )
}

const GRAPH_CARD_WIDTH = 220
const GRAPH_CARD_HEIGHT = 112
const GRAPH_PADDING = 56
const GRAPH_LAYER_GAP = 124
const GRAPH_ORDER_GAP = 32
const GRAPH_LAYER_BAND_PADDING = 18
const GRAPH_LAYER_LABEL_SIZE = 22

type PositionedGraphNode = {
  id: string
  layer: number
  order: number
  x: number
  y: number
}

function getGraphNodePosition(node: VisibleGraphDerivation['nodes'][number], direction: GraphDirection): PositionedGraphNode {
  return {
    ...node,
    x: direction === 'lr'
      ? GRAPH_PADDING + node.layer * (GRAPH_CARD_WIDTH + GRAPH_LAYER_GAP)
      : GRAPH_PADDING + node.order * (GRAPH_CARD_WIDTH + GRAPH_ORDER_GAP),
    y: direction === 'lr'
      ? GRAPH_PADDING + GRAPH_LAYER_LABEL_SIZE + node.order * (GRAPH_CARD_HEIGHT + GRAPH_ORDER_GAP)
      : GRAPH_PADDING + GRAPH_LAYER_LABEL_SIZE + node.layer * (GRAPH_CARD_HEIGHT + GRAPH_LAYER_GAP),
  }
}

function buildDependencyPath(source: PositionedGraphNode, target: PositionedGraphNode, direction: GraphDirection): string {
  if (direction === 'lr') {
    const sx = source.x + GRAPH_CARD_WIDTH
    const sy = source.y + GRAPH_CARD_HEIGHT / 2
    const tx = target.x
    const ty = target.y + GRAPH_CARD_HEIGHT / 2
    const mx = sx + Math.max(40, (tx - sx) / 2)
    return `M ${sx} ${sy} C ${mx} ${sy}, ${tx - Math.max(40, (tx - sx) / 2)} ${ty}, ${tx} ${ty}`
  }

  const sx = source.x + GRAPH_CARD_WIDTH / 2
  const sy = source.y + GRAPH_CARD_HEIGHT
  const tx = target.x + GRAPH_CARD_WIDTH / 2
  const ty = target.y
  const my = sy + Math.max(36, (ty - sy) / 2)
  return `M ${sx} ${sy} C ${sx} ${my}, ${tx} ${ty - Math.max(36, (ty - sy) / 2)}, ${tx} ${ty}`
}

function GraphView({
  tickets,
  graph,
  selectedId,
  search,
  direction,
  showCriticalPath,
  onSelect,
}: {
  tickets: DerivedTicket[]
  graph: VisibleGraphDerivation
  selectedId?: string
  search: string
  direction: GraphDirection
  showCriticalPath: boolean
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current || !selectedId || graph.hasCycle) return
    const selectedCard = containerRef.current.querySelector<HTMLElement>(`[data-ticket-id="${selectedId}"]`)
    selectedCard?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [graph.hasCycle, selectedId, direction])

  const {
    ticketById,
    matchingIds,
    criticalNodeIds,
    criticalEdgeIds,
    relatedNodeIds,
    relatedTargetIds,
    positionedNodes,
    positionedNodeById,
    layerIndexes,
    width,
    height,
  } = useMemo(() => {
    const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]))
    const matchingIds = new Set(tickets.filter((ticket) => matchesSearch(ticket, search)).map((ticket) => ticket.id))
    const criticalNodeIds = new Set(graph.criticalPath.nodeIds)
    const criticalEdgeIds = new Set(graph.criticalPath.edgeIds)
    const relatedNodeIds = new Set(graph.relatedEdges.flatMap((edge) => [edge.source, edge.target]))
    const relatedTargetIds = new Set(graph.relatedEdges.map((edge) => edge.target))
    const positionedNodes = graph.nodes.map((node) => getGraphNodePosition(node, direction))
    const positionedNodeById = new Map(positionedNodes.map((node) => [node.id, node]))
    const layerIndexes = Array.from(new Set(graph.nodes.map((node) => node.layer))).sort((a, b) => a - b)

    const maxX = positionedNodes.reduce((value, node) => Math.max(value, node.x + GRAPH_CARD_WIDTH), 0)
    const maxY = positionedNodes.reduce((value, node) => Math.max(value, node.y + GRAPH_CARD_HEIGHT), 0)

    return {
      ticketById,
      matchingIds,
      criticalNodeIds,
      criticalEdgeIds,
      relatedNodeIds,
      relatedTargetIds,
      positionedNodes,
      positionedNodeById,
      layerIndexes,
      width: Math.max(maxX + GRAPH_PADDING, 640),
      height: Math.max(maxY + GRAPH_PADDING, 320),
    }
  }, [tickets, graph, direction, search])

  if (graph.hasCycle) return <GraphCycleState graph={graph} />
  if (graph.nodes.length === 0) return <GraphEmptyState message="No tickets match the current graph filters." />

  return (
    <div className="graph-view">
      <GraphLegend showCriticalPath={showCriticalPath} />
      <div className="graph-canvas" ref={containerRef}>
        <div className="graph-stage" style={{ width, height }}>
          <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <defs>
              <marker id="graph-arrow-dep" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
              <marker id="graph-arrow-related" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>

            {layerIndexes.map((layer) => {
              const nodesInLayer = positionedNodes.filter((node) => node.layer === layer)
              if (nodesInLayer.length === 0) return null
              const minX = Math.min(...nodesInLayer.map((node) => node.x))
              const maxX = Math.max(...nodesInLayer.map((node) => node.x + GRAPH_CARD_WIDTH))
              const minY = Math.min(...nodesInLayer.map((node) => node.y)) - GRAPH_LAYER_LABEL_SIZE
              const maxY = Math.max(...nodesInLayer.map((node) => node.y + GRAPH_CARD_HEIGHT))
              const isHorizontal = direction === 'lr'
              return (
                <g key={`layer-${layer}`}>
                  <rect
                    className="graph-layer-band"
                    x={isHorizontal ? minX - GRAPH_LAYER_BAND_PADDING : minX - GRAPH_LAYER_BAND_PADDING}
                    y={isHorizontal ? minY - GRAPH_LAYER_BAND_PADDING : minY - GRAPH_LAYER_BAND_PADDING}
                    width={isHorizontal ? maxX - minX + GRAPH_LAYER_BAND_PADDING * 2 : maxX - minX + GRAPH_LAYER_BAND_PADDING * 2}
                    height={isHorizontal ? maxY - minY + GRAPH_LAYER_BAND_PADDING * 2 : maxY - minY + GRAPH_LAYER_BAND_PADDING * 2}
                    rx="14"
                  />
                  <text className="graph-layer-label" x={minX} y={minY - 4}>Layer {layer}</text>
                </g>
              )
            })}

            {graph.dependencyEdges.map((edge) => {
              const source = positionedNodeById.get(edge.source)
              const target = positionedNodeById.get(edge.target)
              if (!source || !target) return null
              const className = [
                'graph-edge',
                'dependency',
                matchingIds.size > 0 && !(matchingIds.has(edge.source) || matchingIds.has(edge.target)) ? 'dimmed' : '',
                showCriticalPath && criticalEdgeIds.has(edge.id) ? 'critical' : '',
              ].filter(Boolean).join(' ')
              return (
                <path
                  key={edge.id}
                  className={className}
                  d={buildDependencyPath(source, target, direction)}
                  markerEnd="url(#graph-arrow-dep)"
                />
              )
            })}

            {graph.relatedEdges.map((edge) => {
              const source = positionedNodeById.get(edge.source)
              const target = positionedNodeById.get(edge.target)
              if (!source || !target) return null
              const className = [
                'graph-edge',
                'related',
                matchingIds.size > 0 && !(matchingIds.has(edge.source) || matchingIds.has(edge.target)) ? 'dimmed' : '',
              ].filter(Boolean).join(' ')
              return (
                <path
                  key={edge.id}
                  className={className}
                  d={buildDependencyPath(source, target, direction)}
                  markerEnd="url(#graph-arrow-related)"
                />
              )
            })}
          </svg>

          {positionedNodes.map((node) => {
            const ticket = ticketById.get(node.id)
            if (!ticket) return null
            const epicLabel = getEpicLabel(ticket, ticketById)
            const isSearchMatch = matchingIds.size === 0 || matchingIds.has(ticket.id)
            const isRelatedNode = relatedNodeIds.has(ticket.id)
            const isRelatedTarget = relatedTargetIds.has(ticket.id)
            const status = ticket.status || 'unknown'
            const statusClass = `status-${normalizeStatus(status).replace(/\s+/g, '-')}`
            const className = [
              'graph-ticket-card',
              selectedId === ticket.id ? 'selected' : '',
              ticket.ready ? 'ready' : '',
              showCriticalPath && criticalNodeIds.has(ticket.id) ? 'critical' : '',
              isRelatedNode ? 'related-context' : '',
              isRelatedTarget ? 'related-target' : '',
              !isSearchMatch ? 'search-dimmed' : '',
              matchingIds.size > 0 && isSearchMatch ? 'search-match' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                key={ticket.id}
                type="button"
                className={className}
                data-ticket-id={ticket.id}
                style={{ left: node.x, top: node.y, width: GRAPH_CARD_WIDTH, height: GRAPH_CARD_HEIGHT }}
                onClick={() => onSelect(ticket.id)}
                title={summarizeTicketBody(ticket.body) || ticket.title}
              >
                <div className="graph-ticket-card-top">
                  <strong>{ticket.id}</strong>
                  <div className="graph-ticket-card-badges">
                    {ticket.ready ? <span className="badge compact ready">ready</span> : null}
                    <span className={`badge compact ${statusClass}`}>{status}</span>
                  </div>
                </div>
                <div className="graph-ticket-card-title">{ticket.title}</div>
                <div className="graph-ticket-card-meta">
                  <span>{epicLabel || 'No epic'}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KanbanView({
  tickets,
  selectedId,
  onSelect,
}: {
  tickets: DerivedTicket[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, DerivedTicket[]>()
    for (const ticket of tickets) {
      const status = ticket.status || 'unknown'
      const items = map.get(status) ?? []
      items.push(ticket)
      map.set(status, items)
    }
    return Array.from(map.entries()).sort(([a], [b]) => compareStatuses(a, b))
  }, [tickets])

  return (
    <div className="kanban-board">
      {grouped.map(([status, items]) => (
        <section key={status} className="kanban-column">
          <header>
            <h3>{status}</h3>
            <span>{items.length}</span>
          </header>
          <div className="kanban-cards">
            {items.map((ticket) => (
              <button
                key={ticket.id}
                className={`kanban-card ${selectedId === ticket.id ? 'selected' : ''}`}
                onClick={() => onSelect(ticket.id)}
                type="button"
              >
                <div className="kanban-card-header">
                  <strong title={getTicketHoverText(ticket)}>{ticket.id}</strong>
                  {ticket.ready ? <span className="badge ready">ready</span> : null}
                </div>
                <div className="kanban-card-title">{ticket.title}</div>
                <div className="kanban-card-meta">
                  {ticket.priority !== undefined ? <span>P{ticket.priority}</span> : null}
                  <span>{ticket.blockedBy.length} deps</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function TicketSidebar({
  tickets,
  selectedId,
  onSelect,
  statuses,
  epics,
  filters,
  onFiltersChange,
  selectedTicket,
}: {
  tickets: DerivedTicket[]
  selectedId?: string
  onSelect: (id: string) => void
  statuses: string[]
  epics: DerivedTicket[]
  filters: SidebarFilters
  onFiltersChange: (filters: SidebarFilters) => void
  selectedTicket?: DerivedTicket
}) {
  const selectedStatusSet = new Set(filters.statuses.map((status) => normalizeStatus(status)))
  const hasActiveFilters = filters.statuses.length > 0 || filters.linkedOnly || filters.dependentOnly || Boolean(filters.epicId)

  return (
    <aside className="ticket-sidebar">
      <div className="ticket-sidebar-header">
        <strong>Tickets</strong>
        <span>{tickets.length}</span>
      </div>

      <div className="ticket-sidebar-filters">
        <div className="ticket-sidebar-filter-group">
          <label htmlFor="epic-filter">Epic</label>
          <select
            id="epic-filter"
            value={filters.epicId}
            onChange={(event) => onFiltersChange({ ...filters, epicId: event.target.value })}
          >
            <option value="">All tickets</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.id} — {epic.title}
              </option>
            ))}
          </select>
        </div>

        <div className="ticket-sidebar-filter-group">
          <div className="ticket-sidebar-filter-label">Status</div>
          <div className="ticket-sidebar-filter-options">
            {statuses.map((status) => {
              const normalizedStatus = normalizeStatus(status)
              return (
                <label key={status} className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={selectedStatusSet.has(normalizedStatus)}
                    onChange={(event) => {
                      const nextStatuses = event.target.checked
                        ? [...filters.statuses, status]
                        : filters.statuses.filter((candidate) => normalizeStatus(candidate) !== normalizedStatus)
                      onFiltersChange({ ...filters, statuses: nextStatuses })
                    }}
                  />
                  {status}
                </label>
              )
            })}
          </div>
        </div>

        <div className="ticket-sidebar-filter-group">
          <div className="ticket-sidebar-filter-label">Scope</div>
          <div className="ticket-sidebar-filter-options stacked">
            <label className="checkbox compact">
              <input
                type="checkbox"
                checked={filters.linkedOnly}
                disabled={!selectedTicket}
                onChange={(event) => onFiltersChange({ ...filters, linkedOnly: event.target.checked })}
              />
              linked to selected
            </label>
            <label className="checkbox compact">
              <input
                type="checkbox"
                checked={filters.dependentOnly}
                disabled={!selectedTicket}
                onChange={(event) => onFiltersChange({ ...filters, dependentOnly: event.target.checked })}
              />
              dependency-related to selected
            </label>
          </div>
          {!selectedTicket ? <div className="filter-hint">Select a ticket to enable relation filters.</div> : null}
        </div>

        <div className="ticket-sidebar-filter-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!hasActiveFilters}
            onClick={() => onFiltersChange(createDefaultSidebarFilters())}
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="ticket-sidebar-list">
        {tickets.length === 0 ? (
          <div className="empty-state">No tickets match the current filters.</div>
        ) : (
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              className={`ticket-sidebar-item ${selectedId === ticket.id ? 'selected' : ''}`}
              onClick={() => onSelect(ticket.id)}
            >
              <div className="ticket-sidebar-item-top">
                <strong title={getTicketHoverText(ticket)}>{ticket.id}</strong>
                <StatusBadge ticket={ticket} />
              </div>
              <div className="ticket-sidebar-item-title">{ticket.title}</div>
              <div className="ticket-sidebar-item-meta">
                {ticket.ready ? <span className="badge ready">ready</span> : null}
                {ticket.priority !== undefined ? <span>P{ticket.priority}</span> : null}
                {ticket.parent ? <span>epic {ticket.parent}</span> : null}
                <span>{ticket.blockedBy.length} deps</span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

function RelatedList({
  label,
  ids,
  ticketById,
  onSelect,
}: {
  label: string
  ids: string[]
  ticketById: Map<string, DerivedTicket>
  onSelect: (id: string) => void
}) {
  return (
    <div className="related-block">
      <strong>{label}</strong>
      {ids.length === 0 ? (
        <div className="empty-inline">None</div>
      ) : (
        <div className="related-list">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              className="ticket-link"
              onClick={() => onSelect(id)}
              title={getTicketHoverText(ticketById.get(id))}
            >
              {id}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailsView({
  ticket,
  ticketById,
  onSelect,
}: {
  ticket?: DerivedTicket
  ticketById: Map<string, DerivedTicket>
  onSelect: (id: string) => void
}) {
  if (!ticket) {
    return <div className="empty-state">Select a ticket in Graph or Kanban.</div>
  }

  return (
    <div className="details-view">
      <header className="details-header">
        <div>
          <h2>{ticket.title}</h2>
          <div className="details-subtitle" title={getTicketHoverText(ticket)}>{ticket.id}</div>
        </div>
        <StatusBadge ticket={ticket} />
      </header>

      <div className="meta-grid">
        <div><strong>Type</strong><span>{ticket.type || '—'}</span></div>
        <div><strong>Priority</strong><span>{ticket.priority ?? '—'}</span></div>
        <div><strong>Assignee</strong><span>{ticket.assignee || '—'}</span></div>
        <div><strong>Created</strong><span>{ticket.created || '—'}</span></div>
        <div><strong>Ready</strong><span>{ticket.ready ? 'yes' : 'no'}</span></div>
        <div><strong>File</strong><span>{ticket.filePath}</span></div>
      </div>

      <div className="tag-row">
        {ticket.tags.map((tag) => (
          <span key={tag} className="badge tag">{tag}</span>
        ))}
      </div>

      <RelatedList label="Depends on" ids={ticket.blockedBy} ticketById={ticketById} onSelect={onSelect} />
      <RelatedList label="Related" ids={ticket.links} ticketById={ticketById} onSelect={onSelect} />
      <RelatedList label="Unblocks" ids={ticket.unblocks} ticketById={ticketById} onSelect={onSelect} />
      <RelatedList label="Missing deps" ids={ticket.missingDeps} ticketById={ticketById} onSelect={onSelect} />

      <section className="markdown-body">
        <ReactMarkdown>{ticket.body || '_No body_'}</ReactMarkdown>
      </section>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [tab, setTab] = useState<TabKey>('graph')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [hideClosed, setHideClosed] = useState(false)
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilters>(() => createDefaultSidebarFilters())
  const [graphDirection, setGraphDirection] = useState<GraphDirection>('lr')
  const [showCriticalPath, setShowCriticalPath] = useState(true)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/tickets')
        const payload: AppData = await response.json()
        setData(payload)
        setSelectedId((currentSelectedId) => {
          const stillExists = currentSelectedId && payload.tickets.some((ticket) => ticket.id === currentSelectedId)
          if (stillExists) return currentSelectedId
          const firstReady = payload.tickets.find((ticket) => ticket.ready)
          return firstReady?.id || payload.tickets[0]?.id
        })
        hasLoadedOnceRef.current = true
      } catch (error) {
        console.error('Failed to load tickets', error)
      }
    }

    void loadData()

    const eventSource = new EventSource('/api/events')
    const handleReload = () => {
      void loadData()
    }
    const handleReloadError = (event: MessageEvent<string>) => {
      console.error('Ticket reload failed', event.data)
    }

    eventSource.addEventListener('reload', handleReload)
    eventSource.addEventListener('reload-error', handleReloadError as EventListener)

    return () => {
      eventSource.removeEventListener('reload', handleReload)
      eventSource.removeEventListener('reload-error', handleReloadError as EventListener)
      eventSource.close()
    }
  }, [])

  const baseTickets = useMemo(() => {
    if (!data) return []
    return data.tickets.filter((ticket) => !hideClosed || !ticket.isClosed)
  }, [data, hideClosed])

  const filteredTickets = useMemo(() => baseTickets.filter((ticket) => matchesSearch(ticket, search)), [baseTickets, search])
  const selectedTicket = data?.tickets.find((ticket) => ticket.id === selectedId)

  const visibleTickets = useMemo(
    () => getVisibleTickets(filteredTickets, selectedTicket, sidebarFilters),
    [filteredTickets, selectedTicket, sidebarFilters],
  )

  const graphTickets = useMemo(
    () => getVisibleTickets(baseTickets, selectedTicket, sidebarFilters),
    [baseTickets, selectedTicket, sidebarFilters],
  )

  const visibleGraph = useMemo(
    () => (data ? deriveVisibleGraph(data.graph, graphTickets, selectedTicket) : undefined),
    [data, graphTickets, selectedTicket],
  )

  if (!data || !visibleGraph) {
    return <div className="loading">{hasLoadedOnceRef.current ? 'Refreshing tickets…' : 'Loading tickets…'}</div>
  }

  const statuses = getAvailableStatuses(data.tickets).sort(compareStatuses)
  const epicTickets = getEpicTickets(data.tickets)
  const ticketById = new Map(data.tickets.map((ticket) => [ticket.id, ticket]))

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1><span className="product-badge">AWB</span> agentic workbench</h1>
          <div className="project-path">{data.projectDir}</div>
        </div>
        <div className="toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search id or title" />
          <label className="checkbox">
            <input type="checkbox" checked={hideClosed} onChange={(event) => setHideClosed(event.target.checked)} />
            hide closed
          </label>
        </div>
      </header>

      <div className="stats-row">
        <span>Total: {data.stats.total}</span>
        <span>Open: {data.stats.open}</span>
        <span>Closed: {data.stats.closed}</span>
        <span>Ready: {data.stats.ready}</span>
        {data.graph.hasCycle ? <span className="stats-warning">Dependency cycle detected</span> : <span>Critical path: {data.graph.criticalPath.length} edges</span>}
      </div>

      <nav className="tabs">
        <button className={tab === 'graph' ? 'active' : ''} onClick={() => setTab('graph')} type="button">Graph</button>
        <button className={tab === 'kanban' ? 'active' : ''} onClick={() => setTab('kanban')} type="button">Kanban</button>
        <button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')} type="button">Details</button>
      </nav>

      <main className="content">
        <div className="content-workspace">
          {tab === 'graph' ? (
            <div className="split-view split-view-graph">
              <TicketSidebar
                tickets={visibleTickets}
                selectedId={selectedId}
                onSelect={setSelectedId}
                statuses={statuses}
                epics={epicTickets}
                filters={sidebarFilters}
                onFiltersChange={setSidebarFilters}
                selectedTicket={selectedTicket}
              />
              <div className="graph-panel">
                <div className="graph-controls">
                  <div className="graph-controls-group">
                    <span className="graph-controls-label">Layout</span>
                    <div className="graph-control-segment" role="group" aria-label="Graph layout direction">
                      <button
                        type="button"
                        className={graphDirection === 'lr' ? 'active' : ''}
                        aria-pressed={graphDirection === 'lr'}
                        onClick={() => setGraphDirection('lr')}
                      >
                        Left → right
                      </button>
                      <button
                        type="button"
                        className={graphDirection === 'tb' ? 'active' : ''}
                        aria-pressed={graphDirection === 'tb'}
                        onClick={() => setGraphDirection('tb')}
                      >
                        Top → bottom
                      </button>
                    </div>
                  </div>
                  <div className="graph-controls-group">
                    <span className="graph-controls-label">Path</span>
                    <label className="checkbox compact graph-toggle">
                      <input type="checkbox" checked={showCriticalPath} onChange={(event) => setShowCriticalPath(event.target.checked)} />
                      highlight critical path
                    </label>
                  </div>
                </div>
                <GraphView
                  tickets={graphTickets}
                  graph={visibleGraph}
                  selectedId={selectedId}
                  search={search}
                  direction={graphDirection}
                  showCriticalPath={showCriticalPath}
                  onSelect={setSelectedId}
                />
              </div>
              <aside className="details-pane">
                <DetailsView ticket={selectedTicket} ticketById={ticketById} onSelect={(id) => { setSelectedId(id); setTab('details') }} />
              </aside>
            </div>
          ) : null}

          {tab === 'kanban' ? <KanbanView tickets={filteredTickets} selectedId={selectedId} onSelect={setSelectedId} /> : null}

          {tab === 'details' ? (
            <div className="split-view split-view-details">
              <TicketSidebar
                tickets={visibleTickets}
                selectedId={selectedId}
                onSelect={setSelectedId}
                statuses={statuses}
                epics={epicTickets}
                filters={sidebarFilters}
                onFiltersChange={setSidebarFilters}
                selectedTicket={selectedTicket}
              />
              <section className="details-pane details-pane-full">
                <DetailsView ticket={selectedTicket} ticketById={ticketById} onSelect={(id) => { setSelectedId(id); setTab('details') }} />
              </section>
            </div>
          ) : null}
        </div>

      </main>
    </div>
  )
}
