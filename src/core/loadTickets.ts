import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { deriveData } from './deriveData.js'
import { parseTicket } from './parseTicket.js'
import type { AppData, Ticket } from './types.js'

export async function loadTickets(projectDir: string, ticketsDir = '.tickets'): Promise<AppData> {
  const absoluteTicketsDir = path.resolve(projectDir, ticketsDir)
  const entries = await fg('*.md', { cwd: absoluteTicketsDir, absolute: true })

  const tickets: Ticket[] = []

  for (const entry of entries.sort()) {
    const source = await fs.readFile(entry, 'utf8')
    tickets.push(parseTicket(entry, source))
  }

  return deriveData(path.resolve(projectDir), absoluteTicketsDir, tickets)
}
