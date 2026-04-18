import type { ReactNode } from 'react'
import type { DerivedTicket } from '../core/types'
import type { VisibleGraphDerivation } from '../core/graph'
import type { SidebarFilters } from './filtering'
import type { ViewportMode } from './useViewportMode'
import type { AgentPanelState } from '../agent/types'
import type { AgentTranscriptEntry, ToolActivityEntry } from './useAgentPanel'
import { AgentPanel } from './AgentPanel'
import {
  AgentOverlay,
  DetailsView,
  GraphPanel,
  KanbanView,
  MobileWorkspaceHeader,
  TicketSidebar,
  WorkspaceTabsHeader,
  WorkspaceTopBar,
  type GraphDirection,
  type TabKey,
} from './workspace'
import { closeMobileAgentOverlay, openMobileDetailsForTicket } from './mobileFlow'

export type WorkspaceLayoutProps = {
  viewportMode: ViewportMode
  projectDir: string
  tab: TabKey
  onTabChange: (tab: TabKey) => void
  search: string
  onSearchChange: (value: string) => void
  hideClosed: boolean
  onHideClosedChange: (value: boolean) => void
  selectedId?: string
  onSelectTicket: (id: string) => void
  dataStats: {
    total: number
    open: number
    closed: number
    ready: number
  }
  graphSummary: {
    hasCycle: boolean
    criticalPathLength: number
  }
  visibleTickets: DerivedTicket[]
  filteredTickets: DerivedTicket[]
  graphTickets: DerivedTicket[]
  visibleGraph: VisibleGraphDerivation
  statuses: string[]
  epicTickets: DerivedTicket[]
  sidebarFilters: SidebarFilters
  onSidebarFiltersChange: (filters: SidebarFilters) => void
  selectedTicket?: DerivedTicket
  ticketById: Map<string, DerivedTicket>
  graphDirection: GraphDirection
  graphDirectionPreference?: GraphDirection
  onGraphDirectionPreferenceChange: (direction: GraphDirection | undefined) => void
  showCriticalPath: boolean
  onShowCriticalPathChange: (value: boolean) => void
  isAgentPanelOpen: boolean
  lastActiveWorkspaceTab: TabKey
  onToggleAgentPanel: () => void
  onCloseAgentPanel: () => void
  agentPanel: {
    state: AgentPanelState
    transcript: AgentTranscriptEntry[]
    toolActivity: ToolActivityEntry[]
    sendPrompt: (text: string) => Promise<void>
    abort: () => Promise<void>
  }
}

export function ResponsiveWorkspaceLayout(props: WorkspaceLayoutProps) {
  if (props.viewportMode === 'mobile') return <MobileWorkspaceLayout {...props} />
  if (props.viewportMode === 'tablet') return <TabletWorkspaceLayout {...props} />
  return <DesktopWorkspaceLayout {...props} />
}

function WorkspaceChrome({
  children,
  viewportMode,
  projectDir,
  tab,
  onTabChange,
  search,
  onSearchChange,
  hideClosed,
  onHideClosedChange,
  isAgentPanelOpen,
  onToggleAgentPanel,
  dataStats,
  graphSummary,
}: Pick<WorkspaceLayoutProps,
  | 'viewportMode'
  | 'projectDir'
  | 'tab'
  | 'onTabChange'
  | 'search'
  | 'onSearchChange'
  | 'hideClosed'
  | 'onHideClosedChange'
  | 'isAgentPanelOpen'
  | 'onToggleAgentPanel'
  | 'dataStats'
  | 'graphSummary'
> & { children: ReactNode }) {
  const agentToggleLabel = viewportMode === 'desktop'
    ? (isAgentPanelOpen ? 'Hide agent panel' : 'Show agent panel')
    : (isAgentPanelOpen ? 'Hide agent' : 'Open agent')

  return (
    <div className={`app-shell viewport-${viewportMode}`}>
      {viewportMode === 'mobile' ? (
        <MobileWorkspaceHeader
          projectDir={projectDir}
          search={search}
          onSearchChange={onSearchChange}
          hideClosed={hideClosed}
          onHideClosedChange={onHideClosedChange}
          isAgentPanelOpen={isAgentPanelOpen}
          onToggleAgentPanel={onToggleAgentPanel}
          agentToggleLabel={agentToggleLabel}
          tab={tab}
          onTabChange={onTabChange}
          total={dataStats.total}
          open={dataStats.open}
          closed={dataStats.closed}
          ready={dataStats.ready}
          hasCycle={graphSummary.hasCycle}
          criticalPathLength={graphSummary.criticalPathLength}
        />
      ) : (
        <>
          <WorkspaceTopBar
            projectDir={projectDir}
            search={search}
            onSearchChange={onSearchChange}
            hideClosed={hideClosed}
            onHideClosedChange={onHideClosedChange}
            isAgentPanelOpen={isAgentPanelOpen}
            onToggleAgentPanel={onToggleAgentPanel}
            agentToggleLabel={agentToggleLabel}
          />
          <WorkspaceTabsHeader
            tab={tab}
            onTabChange={onTabChange}
            total={dataStats.total}
            open={dataStats.open}
            closed={dataStats.closed}
            ready={dataStats.ready}
            hasCycle={graphSummary.hasCycle}
            criticalPathLength={graphSummary.criticalPathLength}
          />
        </>
      )}
      {children}
    </div>
  )
}

function DesktopWorkspaceLayout(props: WorkspaceLayoutProps) {
  const graphView = (
    <div className="split-view split-view-graph">
      <TicketSidebar
        tickets={props.visibleTickets}
        selectedId={props.selectedId}
        onSelect={props.onSelectTicket}
        statuses={props.statuses}
        epics={props.epicTickets}
        filters={props.sidebarFilters}
        onFiltersChange={props.onSidebarFiltersChange}
        selectedTicket={props.selectedTicket}
      />
      <GraphPanel
        tickets={props.graphTickets}
        graph={props.visibleGraph}
        selectedId={props.selectedId}
        search={props.search}
        direction={props.graphDirection}
        directionPreference={props.graphDirectionPreference}
        showCriticalPath={props.showCriticalPath}
        onSelect={props.onSelectTicket}
        onDirectionPreferenceChange={props.onGraphDirectionPreferenceChange}
        onShowCriticalPathChange={props.onShowCriticalPathChange}
        autoDirectionLabel="Auto"
      />
      <aside className="details-pane">
        <DetailsView ticket={props.selectedTicket} ticketById={props.ticketById} onSelect={props.onSelectTicket} />
      </aside>
    </div>
  )

  return (
    <WorkspaceChrome {...props}>
      <main className={`content ${props.isAgentPanelOpen ? 'content-with-agent-panel' : ''}`}>
        <div className="content-workspace">
          {props.tab === 'graph' ? graphView : null}
          {props.tab === 'kanban' ? <KanbanView tickets={props.filteredTickets} selectedId={props.selectedId} onSelect={props.onSelectTicket} /> : null}
          {props.tab === 'details' ? (
            <div className="split-view split-view-details">
              <TicketSidebar
                tickets={props.visibleTickets}
                selectedId={props.selectedId}
                onSelect={props.onSelectTicket}
                statuses={props.statuses}
                epics={props.epicTickets}
                filters={props.sidebarFilters}
                onFiltersChange={props.onSidebarFiltersChange}
                selectedTicket={props.selectedTicket}
              />
              <section className="details-pane details-pane-full">
                <DetailsView ticket={props.selectedTicket} ticketById={props.ticketById} onSelect={props.onSelectTicket} />
              </section>
            </div>
          ) : null}
        </div>

        {props.isAgentPanelOpen ? (
          <AgentPanel
            ticket={props.selectedTicket}
            state={props.agentPanel.state}
            transcript={props.agentPanel.transcript}
            toolActivity={props.agentPanel.toolActivity}
            onSendPrompt={props.agentPanel.sendPrompt}
            onAbort={props.agentPanel.abort}
          />
        ) : null}
      </main>
    </WorkspaceChrome>
  )
}

function TabletWorkspaceLayout(props: WorkspaceLayoutProps) {
  return (
    <WorkspaceChrome {...props}>
      <main className="content tablet-content">
        <div className="content-workspace tablet-workspace">
          {props.tab === 'graph' ? (
            <div className="split-view split-view-tablet">
              <TicketSidebar
                tickets={props.visibleTickets}
                selectedId={props.selectedId}
                onSelect={props.onSelectTicket}
                statuses={props.statuses}
                epics={props.epicTickets}
                filters={props.sidebarFilters}
                onFiltersChange={props.onSidebarFiltersChange}
                selectedTicket={props.selectedTicket}
              />
              <GraphPanel
                tickets={props.graphTickets}
                graph={props.visibleGraph}
                selectedId={props.selectedId}
                search={props.search}
                direction={props.graphDirection}
                directionPreference={props.graphDirectionPreference}
                showCriticalPath={props.showCriticalPath}
                onSelect={props.onSelectTicket}
                onDirectionPreferenceChange={props.onGraphDirectionPreferenceChange}
                onShowCriticalPathChange={props.onShowCriticalPathChange}
                autoDirectionLabel="Auto"
              />
            </div>
          ) : null}

          {props.tab === 'kanban' ? <KanbanView tickets={props.filteredTickets} selectedId={props.selectedId} onSelect={props.onSelectTicket} /> : null}

          {props.tab === 'details' ? (
            <div className="split-view split-view-tablet-details">
              <TicketSidebar
                tickets={props.visibleTickets}
                selectedId={props.selectedId}
                onSelect={props.onSelectTicket}
                statuses={props.statuses}
                epics={props.epicTickets}
                filters={props.sidebarFilters}
                onFiltersChange={props.onSidebarFiltersChange}
                selectedTicket={props.selectedTicket}
              />
              <section className="details-pane details-pane-full">
                <DetailsView ticket={props.selectedTicket} ticketById={props.ticketById} onSelect={props.onSelectTicket} />
              </section>
            </div>
          ) : null}
        </div>

        {props.isAgentPanelOpen ? <MobileAgentOverlay {...props} /> : null}
      </main>
    </WorkspaceChrome>
  )
}

function MobileWorkspaceLayout(props: WorkspaceLayoutProps) {
  const openDetailsForTicket = (id: string) => {
    const next = openMobileDetailsForTicket(id)
    props.onSelectTicket(next.selectedId)
    props.onTabChange(next.tab)
  }

  const showSelectedTicketInDetails = (id: string) => {
    const next = openMobileDetailsForTicket(id)
    props.onSelectTicket(next.selectedId)
    props.onTabChange(next.tab)
  }

  return (
    <WorkspaceChrome {...props}>
      <main className="content mobile-content">
        <div className="content-workspace mobile-workspace">
          {props.tab === 'graph' ? (
            <GraphPanel
              tickets={props.graphTickets}
              graph={props.visibleGraph}
              selectedId={props.selectedId}
              search={props.search}
              direction={props.graphDirection}
              directionPreference={props.graphDirectionPreference}
              showCriticalPath={props.showCriticalPath}
              onSelect={openDetailsForTicket}
              onDirectionPreferenceChange={props.onGraphDirectionPreferenceChange}
              onShowCriticalPathChange={props.onShowCriticalPathChange}
              autoDirectionLabel={`Auto (${props.graphDirection === 'tb' ? 'Top → bottom' : 'Left → right'})`}
            />
          ) : null}

          {props.tab === 'kanban' ? <KanbanView tickets={props.filteredTickets} selectedId={props.selectedId} onSelect={showSelectedTicketInDetails} /> : null}

          {props.tab === 'details' ? (
            <section className="details-pane details-pane-mobile">
              <DetailsView ticket={props.selectedTicket} ticketById={props.ticketById} onSelect={showSelectedTicketInDetails} />
            </section>
          ) : null}
        </div>

        {props.isAgentPanelOpen ? <MobileAgentOverlay {...props} /> : null}
      </main>
    </WorkspaceChrome>
  )
}

function MobileAgentOverlay(props: WorkspaceLayoutProps) {
  const handleClose = () => {
    const next = closeMobileAgentOverlay({
      isAgentPanelOpen: props.isAgentPanelOpen,
      lastActiveWorkspaceTab: props.lastActiveWorkspaceTab,
    })
    props.onTabChange(next.tab)
    props.onCloseAgentPanel()
  }

  return (
    <AgentOverlay
      ticket={props.selectedTicket}
      state={props.agentPanel.state}
      transcript={props.agentPanel.transcript}
      toolActivity={props.agentPanel.toolActivity}
      onSendPrompt={props.agentPanel.sendPrompt}
      onAbort={props.agentPanel.abort}
      onClose={handleClose}
      fullscreen={props.viewportMode === 'mobile'}
      returnToLabel={props.lastActiveWorkspaceTab}
    />
  )
}
