export type Ticket = {
  id: string
  title: string
  body: string
  status?: string
  deps: string[]
  links: string[]
  created?: string
  type?: string
  priority?: number | string
  assignee?: string
  parent?: string
  tags: string[]
  filePath: string
}

export type DerivedTicket = Ticket & {
  blockedBy: string[]
  unblocks: string[]
  ready: boolean
  missingDeps: string[]
  isClosed: boolean
}

import type { GraphDerivation } from './graph.js'

export type AppData = {
  projectDir: string
  ticketsDir: string
  tickets: DerivedTicket[]
  statuses: string[]
  graph: GraphDerivation
  stats: {
    total: number
    open: number
    closed: number
    ready: number
  }
}
