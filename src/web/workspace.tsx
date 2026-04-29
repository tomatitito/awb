import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { AgentPanelState, AgentRunState } from '../agent/types'
import type { VisibleGraphDerivation } from '../core/graph'
import type { DerivedTicket } from '../core/types'
import { AgentPanel } from './AgentPanel'
import { createDefaultSidebarFilters, normalizeFilterValue, type SidebarFilters, UNGROUPED_EPIC_FILTER } from './filtering'
import type { AgentTranscriptEntry, ToolActivityEntry } from './useAgentPanel'
import type { ViewportMode } from './useViewportMode'

export type TabKey = 'graph' | 'kanban' | 'agents' | 'details'
export type GraphDirection = 'lr' | 'tb'

const STATUS_ORDER = ['open', 'in progress', 'closed', 'todo', 'blocked', 'review']
const KANBAN_COLUMN_ORDER = ['backlog', 'open', 'in progress', 'closed']

export function normalizeStatus(status?: string): string {
  return normalizeFilterValue(status)
}

export function compareStatuses(a: string, b: string): number {
  const left = STATUS_ORDER.indexOf(normalizeStatus(a))
  const right = STATUS_ORDER.indexOf(normalizeStatus(b))
  if (left === -1 && right === -1) return a.localeCompare(b)
  if (left === -1) return 1
  if (right === -1) return -1
  return left - right
}

export function matchesSearch(ticket: DerivedTicket, search: string): boolean {
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

function getEpicFilterOptionLabel(epicId: string, epics: DerivedTicket[]): string {
  if (!epicId) return 'All tickets'
  if (epicId === UNGROUPED_EPIC_FILTER) return 'Without epic'
  const epic = epics.find((candidate) => candidate.id === epicId)
  return epic ? `${epic.id} — ${epic.title}` : `Epic ${epicId}`
}

function formatRunCountLabel(count: number): string {
  return `${count} active ${count === 1 ? 'run' : 'runs'}`
}

function EpicFilterSelect({
  epics,
  filters,
  onFiltersChange,
  id,
  dataAwb,
}: {
  epics: DerivedTicket[]
  filters: SidebarFilters
  onFiltersChange: (filters: SidebarFilters) => void
  id: string
  dataAwb?: string
}) {
  return (
    <select id={id} data-awb={dataAwb} value={filters.epicId} onChange={(event) => onFiltersChange({ ...filters, epicId: event.target.value })}>
      <option value="">All tickets</option>
      <option value={UNGROUPED_EPIC_FILTER}>Without epic</option>
      {epics.map((epic) => (
        <option key={epic.id} value={epic.id}>
          {epic.id} — {epic.title}
        </option>
      ))}
    </select>
  )
}

export function WorkspaceTopBar({
  projectDir,
  search,
  onSearchChange,
  hideClosed,
  onHideClosedChange,
  activeAgentRunCount,
  onOpenAgentsTab,
  isAgentPanelOpen,
  onToggleAgentPanel,
  agentToggleLabel,
}: {
  projectDir: string
  search: string
  onSearchChange: (value: string) => void
  hideClosed: boolean
  onHideClosedChange: (value: boolean) => void
  activeAgentRunCount: number
  onOpenAgentsTab: () => void
  isAgentPanelOpen: boolean
  onToggleAgentPanel: () => void
  agentToggleLabel: string
}) {
  return (
    <header className="topbar">
      <div>
        <h1>
          <span className="product-badge">AWB</span> agentic workbench
        </h1>
        <div className="project-path">{projectDir}</div>
      </div>
      <div className="toolbar">
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search id or title" />
        <label className="checkbox">
          <input type="checkbox" checked={hideClosed} onChange={(event) => onHideClosedChange(event.target.checked)} />
          hide closed
        </label>
        <button
          type="button"
          className="secondary-button agent-run-count-button"
          onClick={onOpenAgentsTab}
          aria-label={`Open Agents tab, ${formatRunCountLabel(activeAgentRunCount)}`}
        >
          Agents · {formatRunCountLabel(activeAgentRunCount)}
        </button>
        <button type="button" className={`secondary-button ${isAgentPanelOpen ? 'active' : ''}`} aria-pressed={isAgentPanelOpen} onClick={onToggleAgentPanel}>
          {agentToggleLabel}
        </button>
      </div>
    </header>
  )
}

function WorkspaceViewTabs({ tab, onTabChange, className }: { tab: TabKey; onTabChange: (tab: TabKey) => void; className?: string }) {
  return (
    <nav className={className ?? 'tabs-nav'} aria-label="Views">
      <button data-awb="tab-graph" className={tab === 'graph' ? 'active' : ''} onClick={() => onTabChange('graph')} type="button">
        Graph
      </button>
      <button data-awb="tab-kanban" className={tab === 'kanban' ? 'active' : ''} onClick={() => onTabChange('kanban')} type="button">
        Kanban
      </button>
      <button data-awb="tab-agents" className={tab === 'agents' ? 'active' : ''} onClick={() => onTabChange('agents')} type="button">
        Agents
      </button>
      <button data-awb="tab-details" className={tab === 'details' ? 'active' : ''} onClick={() => onTabChange('details')} type="button">
        Details
      </button>
    </nav>
  )
}

function WorkspaceStatsRow({
  total,
  open,
  closed,
  ready,
  hasCycle,
  criticalPathLength,
  className,
}: {
  total: number
  open: number
  closed: number
  ready: number
  hasCycle: boolean
  criticalPathLength: number
  className?: string
}) {
  return (
    <div className={className ?? 'stats-row'}>
      <span>Total: {total}</span>
      <span>Open: {open}</span>
      <span>Closed: {closed}</span>
      <span>Ready: {ready}</span>
      {hasCycle ? <span className="stats-warning">Dependency cycle detected</span> : <span>Critical path: {criticalPathLength} edges</span>}
    </div>
  )
}

export function WorkspaceTabsHeader({
  tab,
  onTabChange,
  total,
  open,
  closed,
  ready,
  hasCycle,
  criticalPathLength,
}: {
  tab: TabKey
  onTabChange: (tab: TabKey) => void
  total: number
  open: number
  closed: number
  ready: number
  hasCycle: boolean
  criticalPathLength: number
}) {
  return (
    <div className="tabs">
      <WorkspaceViewTabs tab={tab} onTabChange={onTabChange} />
      <WorkspaceStatsRow total={total} open={open} closed={closed} ready={ready} hasCycle={hasCycle} criticalPathLength={criticalPathLength} />
    </div>
  )
}

export function MobileWorkspaceHeader({
  projectDir,
  search,
  onSearchChange,
  hideClosed,
  onHideClosedChange,
  activeAgentRunCount,
  onOpenAgentsTab,
  isAgentPanelOpen,
  onToggleAgentPanel,
  agentToggleLabel,
  tab,
  onTabChange,
  total,
  open,
  closed,
  ready,
  hasCycle,
  criticalPathLength,
  epics,
  filters,
  onFiltersChange,
}: {
  projectDir: string
  search: string
  onSearchChange: (value: string) => void
  hideClosed: boolean
  onHideClosedChange: (value: boolean) => void
  activeAgentRunCount: number
  onOpenAgentsTab: () => void
  isAgentPanelOpen: boolean
  onToggleAgentPanel: () => void
  agentToggleLabel: string
  tab: TabKey
  onTabChange: (tab: TabKey) => void
  total: number
  open: number
  closed: number
  ready: number
  hasCycle: boolean
  criticalPathLength: number
  epics: DerivedTicket[]
  filters: SidebarFilters
  onFiltersChange: (filters: SidebarFilters) => void
}) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-top">
        <div className="mobile-header-branding">
          <h1>
            <span className="product-badge">AWB</span> workbench
          </h1>
          <div className="project-path" title={projectDir}>
            {projectDir}
          </div>
        </div>
        <div className="mobile-header-actions">
          <button
            type="button"
            className="secondary-button mobile-run-count-button"
            onClick={onOpenAgentsTab}
            aria-label={`Open Agents tab, ${formatRunCountLabel(activeAgentRunCount)}`}
          >
            Agents · {activeAgentRunCount}
          </button>
          <button
            type="button"
            data-awb="mobile-agent-toggle"
            className={`secondary-button mobile-agent-button ${isAgentPanelOpen ? 'active' : ''}`}
            aria-pressed={isAgentPanelOpen}
            onClick={onToggleAgentPanel}
          >
            {agentToggleLabel}
          </button>
        </div>
      </div>

      <div className="mobile-header-controls">
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search id or title" />
        <div className="mobile-epic-filter-group">
          <label htmlFor="mobile-epic-filter">Epic scope</label>
          <EpicFilterSelect epics={epics} filters={filters} onFiltersChange={onFiltersChange} id="mobile-epic-filter" dataAwb="mobile-epic-filter" />
          <div className="mobile-epic-filter-summary">Current: {getEpicFilterOptionLabel(filters.epicId, epics)}</div>
        </div>
        <label className="checkbox mobile-hide-closed-toggle">
          <input type="checkbox" checked={hideClosed} onChange={(event) => onHideClosedChange(event.target.checked)} />
          hide closed
        </label>
      </div>

      <WorkspaceViewTabs tab={tab} onTabChange={onTabChange} className="mobile-tabs-nav" />
      <WorkspaceStatsRow total={total} open={open} closed={closed} ready={ready} hasCycle={hasCycle} criticalPathLength={criticalPathLength} className="mobile-stats-row" />
    </header>
  )
}

function StatusBadge({ ticket }: { ticket: DerivedTicket }) {
  const status = ticket.status || 'unknown'
  return <span className={`badge status-${normalizeStatus(status).replace(/\s+/g, '-')}`}>{status}</span>
}

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onSelect: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onSelect()
}

function AgentRunButton({ ticketId, isPending, isActive, onRun }: { ticketId: string; isPending: boolean; isActive: boolean; onRun: (ticketId: string) => Promise<void> }) {
  const isDisabled = isPending || isActive
  const label = isPending ? 'Starting agent run' : isActive ? 'Agent run active' : 'Start agent run'

  return (
    <button
      type="button"
      className={`agent-run-button ${isDisabled ? 'disabled' : 'enabled'}`}
      aria-label={`${label} for ${ticketId}`}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      title={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (isDisabled) return
        void onRun(ticketId)
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
      }}
    >
      <span aria-hidden="true">▶</span>
    </button>
  )
}

function GraphEmptyState({ message }: { message: string }) {
  return <div className="graph-empty-state">{message}</div>
}

function GraphCycleState({ graph }: { graph: VisibleGraphDerivation }) {
  return (
    <div className="graph-empty-state graph-cycle-state">
      <strong>Dependency cycle detected</strong>
      <p>Layered ordering is unavailable because the dependency graph is not acyclic.</p>
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
      <span>
        <i className="swatch dep" /> direct dependency
      </span>
      {showCriticalPath ? (
        <span>
          <i className="swatch critical" /> critical path
        </span>
      ) : null}
      <span>
        <i className="swatch related" /> selected related link
      </span>
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
    x: direction === 'lr' ? GRAPH_PADDING + node.layer * (GRAPH_CARD_WIDTH + GRAPH_LAYER_GAP) : GRAPH_PADDING + node.order * (GRAPH_CARD_WIDTH + GRAPH_ORDER_GAP),
    y:
      direction === 'lr'
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

export function GraphView({
  tickets,
  graph,
  selectedId,
  search,
  direction,
  showCriticalPath,
  onSelect,
  onStartAgentRun,
  activeRunTicketIds,
  pendingRunTicketIds,
}: {
  tickets: DerivedTicket[]
  graph: VisibleGraphDerivation
  selectedId?: string
  search: string
  direction: GraphDirection
  showCriticalPath: boolean
  onSelect: (id: string) => void
  onStartAgentRun: (ticketId: string) => Promise<void>
  activeRunTicketIds: Set<string>
  pendingRunTicketIds: Set<string>
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current || !selectedId || graph.hasCycle) return
    const selectedCard = containerRef.current.querySelector<HTMLElement>(`[data-ticket-id="${selectedId}"]`)
    selectedCard?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [graph.hasCycle, selectedId, direction])

  const { ticketById, matchingIds, criticalNodeIds, criticalEdgeIds, relatedNodeIds, relatedTargetIds, positionedNodes, positionedNodeById, layerIndexes, width, height } =
    useMemo(() => {
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
              return (
                <g key={`layer-${layer}`}>
                  <rect
                    className="graph-layer-band"
                    x={minX - GRAPH_LAYER_BAND_PADDING}
                    y={minY - GRAPH_LAYER_BAND_PADDING}
                    width={maxX - minX + GRAPH_LAYER_BAND_PADDING * 2}
                    height={maxY - minY + GRAPH_LAYER_BAND_PADDING * 2}
                    rx="14"
                  />
                  <text className="graph-layer-label" x={minX} y={minY - 4}>
                    Layer {layer}
                  </text>
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
              ]
                .filter(Boolean)
                .join(' ')
              return <path key={edge.id} className={className} d={buildDependencyPath(source, target, direction)} markerEnd="url(#graph-arrow-dep)" />
            })}

            {graph.relatedEdges.map((edge) => {
              const source = positionedNodeById.get(edge.source)
              const target = positionedNodeById.get(edge.target)
              if (!source || !target) return null
              const className = ['graph-edge', 'related', matchingIds.size > 0 && !(matchingIds.has(edge.source) || matchingIds.has(edge.target)) ? 'dimmed' : '']
                .filter(Boolean)
                .join(' ')
              return <path key={edge.id} className={className} d={buildDependencyPath(source, target, direction)} markerEnd="url(#graph-arrow-related)" />
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
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div
                key={ticket.id}
                role="button"
                tabIndex={0}
                className={className}
                data-awb="graph-ticket-card"
                data-ticket-id={ticket.id}
                style={{ left: node.x, top: node.y, width: GRAPH_CARD_WIDTH, height: GRAPH_CARD_HEIGHT }}
                onClick={() => onSelect(ticket.id)}
                onKeyDown={(event) => handleCardKeyDown(event, () => onSelect(ticket.id))}
                title={summarizeTicketBody(ticket.body) || ticket.title}
              >
                <div className="graph-ticket-card-top">
                  <strong>{ticket.id}</strong>
                  <div className="graph-ticket-card-badges">
                    {ticket.ready ? (
                      <>
                        <span className="badge compact ready">ready</span>
                        <AgentRunButton ticketId={ticket.id} isPending={pendingRunTicketIds.has(ticket.id)} isActive={activeRunTicketIds.has(ticket.id)} onRun={onStartAgentRun} />
                      </>
                    ) : null}
                    <span className={`badge compact ${statusClass}`}>{status}</span>
                  </div>
                </div>
                <div className="graph-ticket-card-title">{ticket.title}</div>
                <div className="graph-ticket-card-meta">
                  <span>{epicLabel || 'No epic'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function GraphPanel({
  tickets,
  graph,
  selectedId,
  search,
  direction,
  directionPreference,
  showCriticalPath,
  onSelect,
  onDirectionPreferenceChange,
  onShowCriticalPathChange,
  onStartAgentRun,
  activeRunTicketIds,
  pendingRunTicketIds,
  autoDirectionLabel,
}: {
  tickets: DerivedTicket[]
  graph: VisibleGraphDerivation
  selectedId?: string
  search: string
  direction: GraphDirection
  directionPreference?: GraphDirection
  showCriticalPath: boolean
  onSelect: (id: string) => void
  onDirectionPreferenceChange: (direction: GraphDirection | undefined) => void
  onShowCriticalPathChange: (value: boolean) => void
  onStartAgentRun: (ticketId: string) => Promise<void>
  activeRunTicketIds: Set<string>
  pendingRunTicketIds: Set<string>
  autoDirectionLabel: string
}) {
  return (
    <section className="graph-panel">
      <div className="graph-controls">
        <div className="graph-controls-group">
          <span className="graph-controls-label">Layout</span>
          <div className="graph-control-segment" role="group" aria-label="Graph layout direction">
            <button
              type="button"
              className={directionPreference === undefined ? 'active' : ''}
              aria-pressed={directionPreference === undefined}
              onClick={() => onDirectionPreferenceChange(undefined)}
            >
              {autoDirectionLabel}
            </button>
            <button
              type="button"
              className={directionPreference === 'lr' ? 'active' : ''}
              aria-pressed={directionPreference === 'lr'}
              onClick={() => onDirectionPreferenceChange('lr')}
            >
              Left → right
            </button>
            <button
              type="button"
              className={directionPreference === 'tb' ? 'active' : ''}
              aria-pressed={directionPreference === 'tb'}
              onClick={() => onDirectionPreferenceChange('tb')}
            >
              Top → bottom
            </button>
          </div>
        </div>
        <div className="graph-controls-group">
          <span className="graph-controls-label">Path</span>
          <label className="checkbox compact graph-toggle">
            <input type="checkbox" checked={showCriticalPath} onChange={(event) => onShowCriticalPathChange(event.target.checked)} />
            highlight critical path
          </label>
        </div>
      </div>
      <GraphView
        tickets={tickets}
        graph={graph}
        selectedId={selectedId}
        search={search}
        direction={direction}
        showCriticalPath={showCriticalPath}
        onSelect={onSelect}
        onStartAgentRun={onStartAgentRun}
        activeRunTicketIds={activeRunTicketIds}
        pendingRunTicketIds={pendingRunTicketIds}
      />
    </section>
  )
}

export function KanbanView({
  tickets,
  selectedId,
  onSelect,
  onStartAgentRun,
  activeRunTicketIds,
  pendingRunTicketIds,
}: {
  tickets: DerivedTicket[]
  selectedId?: string
  onSelect: (id: string) => void
  onStartAgentRun: (ticketId: string) => Promise<void>
  activeRunTicketIds: Set<string>
  pendingRunTicketIds: Set<string>
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, DerivedTicket[]>()

    for (const column of KANBAN_COLUMN_ORDER) {
      map.set(column, [])
    }

    for (const ticket of tickets) {
      const normalized = normalizeStatus(ticket.status)
      const column = normalized === 'open' && !ticket.ready ? 'backlog' : ticket.status || 'unknown'
      const items = map.get(column) ?? []
      items.push(ticket)
      map.set(column, items)
    }

    const orderedEntries = KANBAN_COLUMN_ORDER.map((column) => [column, map.get(column) ?? []] as const)
    const extraEntries = Array.from(map.entries())
      .filter(([column]) => !KANBAN_COLUMN_ORDER.includes(normalizeStatus(column)))
      .sort(([a], [b]) => compareStatuses(a, b))

    return [...orderedEntries, ...extraEntries]
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
              <div
                key={ticket.id}
                role="button"
                tabIndex={0}
                className={`kanban-card ${selectedId === ticket.id ? 'selected' : ''}`}
                onClick={() => onSelect(ticket.id)}
                onKeyDown={(event) => handleCardKeyDown(event, () => onSelect(ticket.id))}
              >
                <div className="kanban-card-header">
                  <strong title={getTicketHoverText(ticket)}>{ticket.id}</strong>
                  <div className="kanban-card-header-badges">
                    {ticket.ready ? (
                      <>
                        <span className="badge ready">ready</span>
                        <AgentRunButton ticketId={ticket.id} isPending={pendingRunTicketIds.has(ticket.id)} isActive={activeRunTicketIds.has(ticket.id)} onRun={onStartAgentRun} />
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="kanban-card-title">{ticket.title}</div>
                <div className="kanban-card-meta">
                  {ticket.priority !== undefined ? <span>P{ticket.priority}</span> : null}
                  <span>{ticket.blockedBy.length} deps</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function formatAgentRunStatus(status: AgentRunState['status']): string {
  return status.replace(/-/g, ' ')
}

function isActiveAgentRun(run: AgentRunState): boolean {
  return run.status === 'queued' || run.status === 'starting' || run.status === 'running'
}

function formatAgentRunEntryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function stringifyAgentRunValue(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  try {
    const result = JSON.stringify(value)
    return result.length > 220 ? `${result.slice(0, 217)}…` : result
  } catch {
    return String(value)
  }
}

function formatAgentRunStartedAt(run: AgentRunState): string {
  const timestamp = run.startedAt ?? run.createdAt
  return new Date(timestamp).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AgentRunDetail({
  run,
  onSendPrompt,
  onAbortRun,
  onOpenWorktree,
  onCleanupWorktree,
  onBack,
  showBack,
}: {
  run?: AgentRunState
  onSendPrompt: (runId: string, text: string) => Promise<void>
  onAbortRun: (runId: string) => Promise<void>
  onOpenWorktree: (runId: string) => Promise<void>
  onCleanupWorktree: (runId: string) => Promise<void>
  onBack?: () => void
  showBack: boolean
}) {
  const [promptText, setPromptText] = useState('Continue implementing the ticket and report progress.')
  const [actionError, setActionError] = useState<string | undefined>()

  if (!run) {
    return <div className="empty-state agents-detail-empty-state">Select a run to inspect its transcript and tool activity.</div>
  }

  const active = isActiveAgentRun(run)
  const transcript = run.transcript.entries
  const toolActivity = [...run.transcript.toolActivity].slice(-12).reverse()
  const hasRetainedWorktree = run.worktree?.mode === 'git-worktree' && run.worktree.status === 'ready' && Boolean(run.worktree.path)

  return (
    <section className="agent-run-detail" data-awb="agent-run-detail">
      <div className="agent-run-detail-header">
        <div>
          <div className="agent-run-detail-title-row">
            {showBack ? (
              <button type="button" className="secondary-button" onClick={onBack}>
                Back
              </button>
            ) : null}
            <strong>
              {run.ticket.ticketId} — {run.ticket.title}
            </strong>
          </div>
          <div className="agent-panel-subtitle">
            Run {run.id.slice(0, 12)} · started {formatAgentRunStartedAt(run)}
          </div>
        </div>
        <span className={`badge agent-run-status status-${normalizeStatus(formatAgentRunStatus(run.status)).replace(/\s+/g, '-')}`}>{formatAgentRunStatus(run.status)}</span>
      </div>

      <div className="agent-panel-section-grid">
        <div>
          <strong>Model</strong>
          <span>{run.model ? `${run.model.provider}/${run.model.id}` : '—'}</span>
        </div>
        <div>
          <strong>Session</strong>
          <span>{run.sessionId ? run.sessionId.slice(0, 12) : '—'}</span>
        </div>
        <div>
          <strong>Queue</strong>
          <span>{run.queuedSteeringCount + run.queuedFollowUpCount}</span>
        </div>
      </div>

      <section className="agent-panel-section">
        <strong>Worktree</strong>
        <div className="agent-panel-section-grid">
          <div>
            <strong>Mode</strong>
            <span>{run.worktree?.mode ?? 'shared-project'}</span>
          </div>
          <div>
            <strong>Status</strong>
            <span>{run.worktree?.status ?? 'not-requested'}</span>
          </div>
          <div>
            <strong>Branch</strong>
            <span>{run.worktree?.branch ?? '—'}</span>
          </div>
          <div>
            <strong>Path</strong>
            <span>{run.worktree?.path ?? '—'}</span>
          </div>
        </div>
        {run.worktree?.cleanupError ? <div className="agent-panel-error">{run.worktree.cleanupError}</div> : null}
        <div className="agent-run-controls" aria-label="Worktree controls">
          <button
            type="button"
            className="secondary-button"
            disabled={!hasRetainedWorktree}
            onClick={() => {
              setActionError(undefined)
              void onOpenWorktree(run.id).catch((error) => {
                setActionError(error instanceof Error ? error.message : String(error))
              })
            }}
          >
            Open in editor
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={run.worktree?.mode !== 'git-worktree' || run.worktree.status === 'cleaned' || run.worktree.status === 'cleaning'}
            onClick={() => {
              setActionError(undefined)
              void onCleanupWorktree(run.id).catch((error) => {
                setActionError(error instanceof Error ? error.message : String(error))
              })
            }}
          >
            Clean up worktree
          </button>
        </div>
        {actionError ? <div className="agent-panel-error">{actionError}</div> : null}
      </section>

      <section className="agent-panel-section">
        <strong>Transcript</strong>
        <div className="agent-transcript">
          {transcript.length === 0 ? <div className="empty-inline">No transcript yet.</div> : null}
          {transcript.map((entry) => (
            <article key={entry.id} className={`agent-transcript-entry ${entry.role === 'assistant' ? 'assistant' : 'error'}`}>
              <div className="agent-transcript-entry-top">
                <span>{entry.role}</span>
                <span>{formatAgentRunEntryTime(entry.timestamp)}</span>
              </div>
              <pre>{entry.text || (entry.role === 'assistant' && entry.isStreaming ? '…' : '')}</pre>
              {entry.errorMessage ? <div className="agent-panel-error">{entry.errorMessage}</div> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="agent-panel-section">
        <strong>Tool activity</strong>
        <div className="agent-tool-list">
          {toolActivity.length === 0 ? <div className="empty-inline">No tool calls yet.</div> : null}
          {toolActivity.map((tool) => (
            <div key={tool.toolCallId} className="agent-tool-item">
              <div className="agent-tool-item-top">
                <span>{tool.toolName}</span>
                <span>{tool.completedAt ? (tool.isError ? 'error' : 'done') : 'running'}</span>
              </div>
              {tool.args !== undefined ? <code>{stringifyAgentRunValue(tool.args)}</code> : null}
              {tool.result !== undefined ? <code>{stringifyAgentRunValue(tool.result)}</code> : null}
            </div>
          ))}
        </div>
      </section>

      {active ? (
        <form
          className="agent-composer"
          onSubmit={(event) => {
            event.preventDefault()
            const text = promptText.trim()
            if (!text) return
            setActionError(undefined)
            void onSendPrompt(run.id, text).catch((error) => {
              setActionError(error instanceof Error ? error.message : String(error))
            })
          }}
        >
          <strong>Follow-up prompt</strong>
          <textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} placeholder="Ask the run what to do next" rows={5} />
          {actionError ? <div className="agent-panel-error">{actionError}</div> : null}
          <div className="agent-run-controls" aria-label="Run controls">
            <button type="submit" className="primary-button" disabled={run.status === 'queued' || run.status === 'starting'}>
              Send
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={run.status === 'queued' || run.status === 'starting'}
              onClick={() => {
                setActionError(undefined)
                void onAbortRun(run.id).catch((error) => {
                  setActionError(error instanceof Error ? error.message : String(error))
                })
              }}
            >
              Stop
            </button>
          </div>
        </form>
      ) : (
        <section className="agent-panel-section">
          <strong>Run state</strong>
          <div className="agent-panel-copy">This run is read-only because it is no longer active.</div>
        </section>
      )}
    </section>
  )
}

export function AgentsView({
  runs,
  selectedRunId,
  onSelectRun,
  onBack,
  onSendPrompt,
  onAbortRun,
  onOpenWorktree,
  onCleanupWorktree,
  viewportMode,
}: {
  runs: AgentRunState[]
  selectedRunId?: string
  onSelectRun: (runId: string) => void
  onBack: () => void
  onSendPrompt: (runId: string, text: string) => Promise<void>
  onAbortRun: (runId: string) => Promise<void>
  onOpenWorktree: (runId: string) => Promise<void>
  onCleanupWorktree: (runId: string) => Promise<void>
  viewportMode: ViewportMode
}) {
  if (runs.length === 0) {
    return <div className="empty-state agents-empty-state">No agent runs yet. Start a run from a ready ticket to see it here.</div>
  }

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0]
  const isMobile = viewportMode === 'mobile'
  const showDetailOnly = isMobile && Boolean(selectedRunId)

  return (
    <section className="agents-view" data-awb="agents-view">
      <header className="agents-view-header">
        <div>
          <h2>Agents</h2>
          <p>Active runs appear first. Within each group, runs are ordered by started time, most recent first.</p>
        </div>
        <span className="badge">{runs.length} total</span>
      </header>
      <div className={`agents-layout ${isMobile ? 'mobile' : 'desktop'}`}>
        {!showDetailOnly ? (
          <div className="agents-run-list" role="list" aria-label="Agent runs">
            {runs.map((run) => (
              <button key={run.id} type="button" className={`agents-run-row ${selectedRun?.id === run.id ? 'selected' : ''}`} role="listitem" onClick={() => onSelectRun(run.id)}>
                <div className="agents-run-row-top">
                  <span className={`badge agent-run-status status-${normalizeStatus(formatAgentRunStatus(run.status)).replace(/\s+/g, '-')}`}>
                    {formatAgentRunStatus(run.status)}
                  </span>
                  <span className="agents-run-started-at">{formatAgentRunStartedAt(run)}</span>
                </div>
                <div className="agents-run-ticket-id">{run.ticket.ticketId}</div>
                <div className="agents-run-ticket-title">{run.ticket.title}</div>
              </button>
            ))}
          </div>
        ) : null}
        {!isMobile || showDetailOnly ? (
          <AgentRunDetail
            run={selectedRun}
            onSendPrompt={onSendPrompt}
            onAbortRun={onAbortRun}
            onOpenWorktree={onOpenWorktree}
            onCleanupWorktree={onCleanupWorktree}
            onBack={onBack}
            showBack={isMobile}
          />
        ) : null}
      </div>
    </section>
  )
}

export function TicketSidebar({
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
          <EpicFilterSelect epics={epics} filters={filters} onFiltersChange={onFiltersChange} id="epic-filter" />
        </div>

        <div className="ticket-sidebar-filter-group">
          <div className="ticket-sidebar-filter-label">Status</div>
          <div className="ticket-sidebar-filter-options">
            {statuses.map((status) => {
              const normalized = normalizeStatus(status)
              return (
                <label key={status} className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={selectedStatusSet.has(normalized)}
                    onChange={(event) => {
                      const nextStatuses = event.target.checked ? [...filters.statuses, status] : filters.statuses.filter((candidate) => normalizeStatus(candidate) !== normalized)
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
          <button type="button" className="secondary-button" disabled={!hasActiveFilters} onClick={() => onFiltersChange(createDefaultSidebarFilters())}>
            Clear filters
          </button>
        </div>
      </div>

      <div className="ticket-sidebar-list">
        {tickets.length === 0 ? (
          <div className="empty-state">No tickets match the current filters.</div>
        ) : (
          tickets.map((ticket) => (
            <button key={ticket.id} type="button" className={`ticket-sidebar-item ${selectedId === ticket.id ? 'selected' : ''}`} onClick={() => onSelect(ticket.id)}>
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

function RelatedList({ label, ids, ticketById, onSelect }: { label: string; ids: string[]; ticketById: Map<string, DerivedTicket>; onSelect: (id: string) => void }) {
  return (
    <div className="related-block">
      <strong>{label}</strong>
      {ids.length === 0 ? (
        <div className="empty-inline">None</div>
      ) : (
        <div className="related-list">
          {ids.map((id) => (
            <button key={id} type="button" className="ticket-link" onClick={() => onSelect(id)} title={getTicketHoverText(ticketById.get(id))}>
              {id}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailsView({ ticket, ticketById, onSelect }: { ticket?: DerivedTicket; ticketById: Map<string, DerivedTicket>; onSelect: (id: string) => void }) {
  if (!ticket) return <div className="empty-state">Select a ticket in Graph or Kanban to open its full details.</div>

  return (
    <div className="details-view" data-awb="details-view" data-selected-ticket-id={ticket.id}>
      <header className="details-header">
        <div>
          <h2>{ticket.title}</h2>
          <div className="details-subtitle" title={getTicketHoverText(ticket)}>
            {ticket.id}
          </div>
        </div>
        <StatusBadge ticket={ticket} />
      </header>

      <div className="meta-grid">
        <div>
          <strong>Type</strong>
          <span>{ticket.type || '—'}</span>
        </div>
        <div>
          <strong>Priority</strong>
          <span>{ticket.priority ?? '—'}</span>
        </div>
        <div>
          <strong>Assignee</strong>
          <span>{ticket.assignee || '—'}</span>
        </div>
        <div>
          <strong>Created</strong>
          <span>{ticket.created || '—'}</span>
        </div>
        <div>
          <strong>Ready</strong>
          <span>{ticket.ready ? 'yes' : 'no'}</span>
        </div>
        <div>
          <strong>File</strong>
          <span>{ticket.filePath}</span>
        </div>
      </div>

      <div className="tag-row">
        {ticket.tags.map((tag) => (
          <span key={tag} className="badge tag">
            {tag}
          </span>
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

export function AgentOverlay({
  ticket,
  state,
  transcript,
  toolActivity,
  onSendPrompt,
  onAbort,
  onRefreshState,
  onClose,
  fullscreen = false,
  returnToLabel,
}: {
  ticket?: DerivedTicket
  state: AgentPanelState
  transcript: AgentTranscriptEntry[]
  toolActivity: ToolActivityEntry[]
  onSendPrompt: (text: string) => Promise<void>
  onAbort: () => Promise<void>
  onRefreshState: () => Promise<void>
  onClose: () => void
  fullscreen?: boolean
  returnToLabel?: TabKey
}) {
  const closeLabel = returnToLabel ? `Back to ${returnToLabel}` : 'Close'

  return (
    <div className={`agent-overlay ${fullscreen ? 'agent-overlay-fullscreen' : ''}`} data-awb="agent-overlay" role="dialog" aria-modal="true" aria-label="Agent panel overlay">
      <button type="button" data-awb="agent-overlay-backdrop" className="agent-overlay-backdrop" aria-label="Close agent panel" onClick={onClose} />
      <div className="agent-overlay-sheet">
        <div className="agent-overlay-header">
          <strong>Agent</strong>
          <button type="button" data-awb="agent-overlay-close" className="secondary-button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        <AgentPanel
          ticket={ticket}
          state={state}
          transcript={transcript}
          toolActivity={toolActivity}
          onSendPrompt={onSendPrompt}
          onAbort={onAbort}
          onRefreshState={onRefreshState}
        />
      </div>
    </div>
  )
}
