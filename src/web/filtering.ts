import type { DerivedTicket } from '../core/types'

export const UNGROUPED_EPIC_FILTER = '__ungrouped__'

export type SidebarFilters = {
  statuses: string[]
  linkedOnly: boolean
  dependentOnly: boolean
  epicId: string
}

export function createDefaultSidebarFilters(): SidebarFilters {
  return {
    statuses: [],
    linkedOnly: false,
    dependentOnly: false,
    epicId: '',
  }
}

export function normalizeFilterValue(value?: string): string {
  return (value || 'unknown').trim().toLowerCase()
}

export function isEpicTicket(ticket: DerivedTicket): boolean {
  return normalizeFilterValue(ticket.type) === 'epic'
}

function isUngroupedTicket(ticket: DerivedTicket): boolean {
  return !ticket.parent && !isEpicTicket(ticket)
}

function matchesSharedEpicFilter(ticket: DerivedTicket, epicId: string): boolean {
  if (!epicId) return true
  if (epicId === UNGROUPED_EPIC_FILTER) return isUngroupedTicket(ticket)
  return ticket.id === epicId || ticket.parent === epicId
}

function createFilterCriteria(selectedTicket: DerivedTicket | undefined, filters: SidebarFilters) {
  return {
    statusFilter: new Set(filters.statuses.map((status) => normalizeFilterValue(status))),
    linkedIds: new Set(selectedTicket?.links ?? []),
    dependencyIds: new Set([...(selectedTicket?.blockedBy ?? []), ...(selectedTicket?.unblocks ?? [])]),
  }
}

function matchesNonEpicFilters(
  ticket: DerivedTicket,
  filters: SidebarFilters,
  criteria: ReturnType<typeof createFilterCriteria>,
): boolean {
  if (criteria.statusFilter.size > 0 && !criteria.statusFilter.has(normalizeFilterValue(ticket.status))) return false
  if (filters.linkedOnly && !criteria.linkedIds.has(ticket.id)) return false
  if (filters.dependentOnly && !criteria.dependencyIds.has(ticket.id)) return false
  return true
}

export function isUngroupedEpicFilter(epicId: string): boolean {
  return epicId === UNGROUPED_EPIC_FILTER
}

export function getEpicTickets(tickets: DerivedTicket[]): DerivedTicket[] {
  return tickets
    .filter((ticket) => isEpicTicket(ticket))
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function getVisibleTickets(
  tickets: DerivedTicket[],
  selectedTicket: DerivedTicket | undefined,
  filters: SidebarFilters,
): DerivedTicket[] {
  const criteria = createFilterCriteria(selectedTicket, filters)
  return tickets.filter((ticket) => matchesNonEpicFilters(ticket, filters, criteria) && matchesSharedEpicFilter(ticket, filters.epicId))
}

export function getVisibleKanbanTickets(
  tickets: DerivedTicket[],
  selectedTicket: DerivedTicket | undefined,
  filters: SidebarFilters,
): DerivedTicket[] {
  const criteria = createFilterCriteria(selectedTicket, filters)

  return tickets.filter((ticket) => {
    if (!matchesNonEpicFilters(ticket, filters, criteria)) return false
    return matchesSharedEpicFilter(ticket, filters.epicId)
  })
}

export function getAvailableStatuses(tickets: DerivedTicket[]): string[] {
  return Array.from(new Set(tickets.map((ticket) => ticket.status || 'unknown')))
}
