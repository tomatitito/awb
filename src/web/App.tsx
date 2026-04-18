import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppData } from '../core/types'
import { deriveVisibleGraph } from '../core/graph'
import {
  createDefaultSidebarFilters,
  getAvailableStatuses,
  getEpicTickets,
  getVisibleKanbanTickets,
  getVisibleTickets,
  type SidebarFilters,
} from './filtering'
import { ResponsiveWorkspaceLayout } from './layouts'
import { useViewportMode } from './useViewportMode'
import { compareStatuses, matchesSearch, type GraphDirection, type TabKey } from './workspace'
import { openAgentPanelFromHeader } from './mobileFlow'
import { useAgentPanel } from './useAgentPanel'

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [tab, setTab] = useState<TabKey>('graph')
  const [lastActiveWorkspaceTab, setLastActiveWorkspaceTab] = useState<TabKey>('graph')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [hideClosed, setHideClosed] = useState(false)
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilters>(() => createDefaultSidebarFilters())
  const [graphDirectionPreference, setGraphDirectionPreference] = useState<GraphDirection | undefined>()
  const [showCriticalPath, setShowCriticalPath] = useState(true)
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false)
  const agentPanel = useAgentPanel()
  const { setSelectedTicketContext } = agentPanel
  const hasLoadedOnceRef = useRef(false)
  const viewportMode = useViewportMode()

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

  useEffect(() => {
    if (!isAgentPanelOpen) {
      setLastActiveWorkspaceTab(tab)
    }
  }, [isAgentPanelOpen, tab])

  const visibleTickets = useMemo(
    () => getVisibleTickets(filteredTickets, selectedTicket, sidebarFilters),
    [filteredTickets, selectedTicket, sidebarFilters],
  )

  const kanbanTickets = useMemo(
    () => getVisibleKanbanTickets(filteredTickets, selectedTicket, sidebarFilters),
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

  const graphDirection = graphDirectionPreference ?? (viewportMode === 'mobile' ? 'tb' : 'lr')

  useEffect(() => {
    void setSelectedTicketContext(selectedTicket ? {
      ticketId: selectedTicket.id,
      title: selectedTicket.title,
      body: selectedTicket.body,
      filePath: selectedTicket.filePath,
    } : undefined)
  }, [selectedTicket, setSelectedTicketContext])

  if (!data || !visibleGraph) {
    return <div className="loading">{hasLoadedOnceRef.current ? 'Refreshing tickets…' : 'Loading tickets…'}</div>
  }

  const statuses = getAvailableStatuses(data.tickets).sort(compareStatuses)
  const epicTickets = getEpicTickets(data.tickets)
  const ticketById = new Map(data.tickets.map((ticket) => [ticket.id, ticket]))

  return (
    <ResponsiveWorkspaceLayout
      viewportMode={viewportMode}
      projectDir={data.projectDir}
      tab={tab}
      onTabChange={setTab}
      search={search}
      onSearchChange={setSearch}
      hideClosed={hideClosed}
      onHideClosedChange={setHideClosed}
      selectedId={selectedId}
      onSelectTicket={(id) => setSelectedId(id)}
      dataStats={data.stats}
      graphSummary={{
        hasCycle: data.graph.hasCycle,
        criticalPathLength: data.graph.criticalPath.length,
      }}
      visibleTickets={visibleTickets}
      filteredTickets={kanbanTickets}
      graphTickets={graphTickets}
      visibleGraph={visibleGraph}
      statuses={statuses}
      epicTickets={epicTickets}
      sidebarFilters={sidebarFilters}
      onSidebarFiltersChange={setSidebarFilters}
      selectedTicket={selectedTicket}
      ticketById={ticketById}
      graphDirection={graphDirection}
      graphDirectionPreference={graphDirectionPreference}
      onGraphDirectionPreferenceChange={setGraphDirectionPreference}
      showCriticalPath={showCriticalPath}
      onShowCriticalPathChange={setShowCriticalPath}
      isAgentPanelOpen={isAgentPanelOpen}
      lastActiveWorkspaceTab={lastActiveWorkspaceTab}
      onToggleAgentPanel={() => {
        if (isAgentPanelOpen) {
          setIsAgentPanelOpen(false)
          return
        }

        const next = openAgentPanelFromHeader({ tab })
        setLastActiveWorkspaceTab(next.lastActiveWorkspaceTab)
        setIsAgentPanelOpen(next.isAgentPanelOpen)
      }}
      onCloseAgentPanel={() => setIsAgentPanelOpen(false)}
      agentPanel={{
        state: agentPanel.state,
        transcript: agentPanel.transcript,
        toolActivity: agentPanel.toolActivity,
        sendPrompt: agentPanel.sendPrompt,
        abort: agentPanel.abort,
      }}
    />
  )
}
