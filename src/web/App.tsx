import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentRunEvent, AgentRunState } from '../agent/types'
import { deriveVisibleGraph } from '../core/graph'
import type { AppData } from '../core/types'
import { abortSpecificAgentRun, createAgentRun, listAgentRuns, sendAgentRunPrompt } from './agentApi'
import { createDefaultSidebarFilters, getAvailableStatuses, getEpicTickets, getVisibleKanbanTickets, getVisibleTickets, type SidebarFilters } from './filtering'
import { ResponsiveWorkspaceLayout } from './layouts'
import { openAgentPanelFromHeader } from './mobileFlow'
import { useAgentPanel } from './useAgentPanel'
import { useViewportMode } from './useViewportMode'
import { compareStatuses, type GraphDirection, matchesSearch, type TabKey } from './workspace'

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [tab, setTab] = useState<TabKey>('graph')
  const [lastActiveWorkspaceTab, setLastActiveWorkspaceTab] = useState<TabKey>('graph')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [selectedAgentRunId, setSelectedAgentRunId] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [hideClosed, setHideClosed] = useState(false)
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilters>(() => createDefaultSidebarFilters())
  const [graphDirectionPreference, setGraphDirectionPreference] = useState<GraphDirection | undefined>()
  const [showCriticalPath, setShowCriticalPath] = useState(true)
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false)
  const [agentRuns, setAgentRuns] = useState<AgentRunState[]>([])
  const [pendingRunTicketIds, setPendingRunTicketIds] = useState<Set<string>>(() => new Set())
  const [runLaunchError, setRunLaunchError] = useState<string | undefined>()
  const agentPanel = useAgentPanel()
  const { setSelectedTicketContext } = agentPanel
  const hasLoadedOnceRef = useRef(false)
  const runLockTicketIdsRef = useRef<Set<string>>(new Set())
  const viewportMode = useViewportMode()

  useEffect(() => {
    const getRunSortTimestamp = (run: AgentRunState): number => run.startedAt ?? run.createdAt
    const isActiveRun = (run: AgentRunState): boolean => run.status === 'queued' || run.status === 'starting' || run.status === 'running'
    const compareRuns = (left: AgentRunState, right: AgentRunState): number => {
      const leftActive = isActiveRun(left)
      const rightActive = isActiveRun(right)
      if (leftActive !== rightActive) return leftActive ? -1 : 1
      return getRunSortTimestamp(right) - getRunSortTimestamp(left)
    }

    const mergeRun = (runs: AgentRunState[], nextRun: AgentRunState): AgentRunState[] => {
      const nextRuns = runs.filter((run) => run.id !== nextRun.id)
      return [nextRun, ...nextRuns].sort(compareRuns)
    }

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

    const loadRuns = async () => {
      try {
        const runs = await listAgentRuns()
        setAgentRuns(runs)
      } catch (error) {
        console.error('Failed to load agent runs', error)
      }
    }

    void loadData()
    void loadRuns()

    const eventSource = new EventSource('/api/events')
    const runEventSource = new EventSource('/api/agent/runs/events')
    const handleReload = () => {
      void loadData()
    }
    const handleReloadError = (event: MessageEvent<string>) => {
      console.error('Ticket reload failed', event.data)
    }

    const handleRunEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as AgentRunEvent | { type: 'ready'; runs: AgentRunState[] }
        if (payload.type === 'ready') {
          setAgentRuns(payload.runs)
          return
        }
        if (payload.type === 'run-created' || payload.type === 'run-updated') {
          setAgentRuns((current) => mergeRun(current, payload.run))
        }
      } catch (error) {
        console.error('Failed to process agent run event', error)
      }
    }

    eventSource.addEventListener('reload', handleReload)
    eventSource.addEventListener('reload-error', handleReloadError as EventListener)
    runEventSource.addEventListener('ready', handleRunEvent as EventListener)
    runEventSource.addEventListener('run-created', handleRunEvent as EventListener)
    runEventSource.addEventListener('run-updated', handleRunEvent as EventListener)

    return () => {
      eventSource.removeEventListener('reload', handleReload)
      eventSource.removeEventListener('reload-error', handleReloadError as EventListener)
      eventSource.close()
      runEventSource.removeEventListener('ready', handleRunEvent as EventListener)
      runEventSource.removeEventListener('run-created', handleRunEvent as EventListener)
      runEventSource.removeEventListener('run-updated', handleRunEvent as EventListener)
      runEventSource.close()
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

  const visibleTickets = useMemo(() => getVisibleTickets(filteredTickets, selectedTicket, sidebarFilters), [filteredTickets, selectedTicket, sidebarFilters])

  const kanbanTickets = useMemo(() => getVisibleKanbanTickets(filteredTickets, selectedTicket, sidebarFilters), [filteredTickets, selectedTicket, sidebarFilters])

  const graphTickets = useMemo(() => getVisibleTickets(baseTickets, selectedTicket, sidebarFilters), [baseTickets, selectedTicket, sidebarFilters])

  const visibleGraph = useMemo(() => (data ? deriveVisibleGraph(data.graph, graphTickets, selectedTicket) : undefined), [data, graphTickets, selectedTicket])

  const graphDirection = graphDirectionPreference ?? (viewportMode === 'mobile' ? 'tb' : 'lr')

  const activeRuns = useMemo(() => agentRuns.filter((run) => run.status === 'queued' || run.status === 'starting' || run.status === 'running'), [agentRuns])

  const activeRunTicketIds = useMemo(() => {
    const ids = new Set<string>()
    for (const run of activeRuns) {
      ids.add(run.ticket.ticketId)
    }
    return ids
  }, [activeRuns])

  const sortedAgentRuns = useMemo(() => {
    const getRunSortTimestamp = (run: AgentRunState): number => run.startedAt ?? run.createdAt
    const isActiveRun = (run: AgentRunState): boolean => run.status === 'queued' || run.status === 'starting' || run.status === 'running'
    return [...agentRuns].sort((left, right) => {
      const leftActive = isActiveRun(left)
      const rightActive = isActiveRun(right)
      if (leftActive !== rightActive) return leftActive ? -1 : 1
      return getRunSortTimestamp(right) - getRunSortTimestamp(left)
    })
  }, [agentRuns])

  useEffect(() => {
    const next = new Set(activeRunTicketIds)
    for (const ticketId of pendingRunTicketIds) next.add(ticketId)
    runLockTicketIdsRef.current = next
  }, [activeRunTicketIds, pendingRunTicketIds])

  useEffect(() => {
    setSelectedAgentRunId((current) => {
      if (current && sortedAgentRuns.some((run) => run.id === current)) return current
      return sortedAgentRuns[0]?.id
    })
  }, [sortedAgentRuns])

  useEffect(() => {
    void setSelectedTicketContext(
      selectedTicket
        ? {
            ticketId: selectedTicket.id,
            title: selectedTicket.title,
            body: selectedTicket.body,
            filePath: selectedTicket.filePath,
          }
        : undefined,
    )
  }, [selectedTicket, setSelectedTicketContext])

  if (!data || !visibleGraph) {
    return <div className="loading">{hasLoadedOnceRef.current ? 'Refreshing tickets…' : 'Loading tickets…'}</div>
  }

  const statuses = getAvailableStatuses(data.tickets).sort(compareStatuses)
  const epicTickets = getEpicTickets(data.tickets)
  const ticketById = new Map(data.tickets.map((ticket) => [ticket.id, ticket]))

  const handleStartAgentRun = async (ticketId: string) => {
    if (runLockTicketIdsRef.current.has(ticketId)) return

    runLockTicketIdsRef.current = new Set(runLockTicketIdsRef.current).add(ticketId)
    setRunLaunchError(undefined)
    setPendingRunTicketIds((current) => new Set(current).add(ticketId))

    try {
      const run = await createAgentRun(ticketId)
      setAgentRuns((current) => {
        const nextRuns = current.filter((candidate) => candidate.id !== run.id)
        return [run, ...nextRuns].sort((left, right) => {
          const leftActive = left.status === 'queued' || left.status === 'starting' || left.status === 'running'
          const rightActive = right.status === 'queued' || right.status === 'starting' || right.status === 'running'
          if (leftActive !== rightActive) return leftActive ? -1 : 1
          return (right.startedAt ?? right.createdAt) - (left.startedAt ?? left.createdAt)
        })
      })
    } catch (error) {
      setRunLaunchError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingRunTicketIds((current) => {
        const next = new Set(current)
        next.delete(ticketId)
        return next
      })
    }
  }

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
      agentRuns={sortedAgentRuns}
      selectedAgentRunId={selectedAgentRunId}
      activeAgentRunCount={activeRuns.length}
      onOpenAgentsTab={() => {
        if (viewportMode === 'mobile') setSelectedAgentRunId(undefined)
        setTab('agents')
      }}
      onSelectAgentRun={setSelectedAgentRunId}
      onBackToAgentsList={() => setSelectedAgentRunId(undefined)}
      onSendAgentRunPrompt={sendAgentRunPrompt}
      onAbortAgentRun={abortSpecificAgentRun}
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
      onStartAgentRun={handleStartAgentRun}
      activeRunTicketIds={activeRunTicketIds}
      pendingRunTicketIds={pendingRunTicketIds}
      runLaunchError={runLaunchError}
      onDismissRunLaunchError={() => setRunLaunchError(undefined)}
      agentPanel={{
        state: agentPanel.state,
        transcript: agentPanel.transcript,
        toolActivity: agentPanel.toolActivity,
        sendPrompt: agentPanel.sendPrompt,
        abort: agentPanel.abort,
        refreshState: agentPanel.refreshState,
      }}
    />
  )
}
