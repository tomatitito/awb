import type { DerivedTicket } from '../core/types'

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

export function getEpicTickets(tickets: DerivedTicket[]): DerivedTicket[] {
  return tickets
    .filter((ticket) => normalizeFilterValue(ticket.type) === 'epic')
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function getVisibleTickets(
  tickets: DerivedTicket[],
  selectedTicket: DerivedTicket | undefined,
  filters: SidebarFilters,
): DerivedTicket[] {
  const statusFilter = new Set(filters.statuses.map((status) => normalizeFilterValue(status)))
  const linkedIds = new Set(selectedTicket?.links ?? [])
  const dependencyIds = new Set([...(selectedTicket?.blockedBy ?? []), ...(selectedTicket?.unblocks ?? [])])

  return tickets.filter((ticket) => {
    if (statusFilter.size > 0 && !statusFilter.has(normalizeFilterValue(ticket.status))) return false
    if (filters.epicId && ticket.id !== filters.epicId && ticket.parent !== filters.epicId) return false
    if (filters.linkedOnly && !linkedIds.has(ticket.id)) return false
    if (filters.dependentOnly && !dependencyIds.has(ticket.id)) return false
    return true
  })
}

export function getAvailableStatuses(tickets: DerivedTicket[]): string[] {
  return Array.from(new Set(tickets.map((ticket) => ticket.status || 'unknown')))
}
