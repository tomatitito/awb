import { deriveGraph } from './graph.js'
import type { AppData, DerivedTicket, Ticket } from './types.js'

const CLOSED_STATUSES = new Set(['closed', 'done', 'resolved'])

export function isClosedStatus(status?: string): boolean {
  return status ? CLOSED_STATUSES.has(status.trim().toLowerCase()) : false
}

export function deriveData(projectDir: string, ticketsDir: string, tickets: Ticket[]): AppData {
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]))
  const reverseDeps = new Map<string, string[]>()

  for (const ticket of tickets) {
    for (const dep of ticket.deps) {
      const dependents = reverseDeps.get(dep) ?? []
      dependents.push(ticket.id)
      reverseDeps.set(dep, dependents)
    }
  }

  const derivedTickets: DerivedTicket[] = tickets.map((ticket) => {
    const missingDeps = ticket.deps.filter((dep) => !byId.has(dep))
    const blockedBy = ticket.deps.filter((dep) => byId.has(dep))
    const isClosed = isClosedStatus(ticket.status)
    const ready = !isClosed && missingDeps.length === 0 && blockedBy.every((dep) => isClosedStatus(byId.get(dep)?.status))

    return {
      ...ticket,
      blockedBy,
      unblocks: reverseDeps.get(ticket.id) ?? [],
      ready,
      missingDeps,
      isClosed,
    }
  })

  const statuses = Array.from(new Set(derivedTickets.map((ticket) => ticket.status || 'unknown')))
  const closed = derivedTickets.filter((ticket) => ticket.isClosed).length
  const ready = derivedTickets.filter((ticket) => ticket.ready).length

  return {
    projectDir,
    ticketsDir,
    tickets: derivedTickets,
    statuses,
    graph: deriveGraph(derivedTickets),
    stats: {
      total: derivedTickets.length,
      open: derivedTickets.length - closed,
      closed,
      ready,
    },
  }
}
