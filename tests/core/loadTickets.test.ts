import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadTickets } from '../../src/core/loadTickets'

const tempDirs: string[] = []

async function makeProject(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-load-tickets-'))
  tempDirs.push(projectDir)
  return projectDir
}

async function writeFile(filePath: string, source: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, source)
}

function ticketSource(fields: Record<string, unknown>, body = 'Body text'): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      for (const item of value) {
        lines.push(`  - ${item}`)
      }
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push('---', `# ${fields.title ?? fields.id}`, '', body)
  return lines.join('\n')
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('loadTickets', () => {
  test('reads only top-level markdown files and returns tickets sorted by entry path', async () => {
    const projectDir = await makeProject()
    const ticketsDir = path.join(projectDir, 'tickets')

    await writeFile(path.join(ticketsDir, 'b.md'), ticketSource({ id: 'ticket-b', status: 'open', deps: ['ticket-a'] }))
    await writeFile(path.join(ticketsDir, 'a.md'), ticketSource({ id: 'ticket-a', status: 'done' }))
    await writeFile(path.join(ticketsDir, 'ignored.txt'), ticketSource({ id: 'ignored', status: 'open' }))
    await writeFile(path.join(ticketsDir, 'nested', 'c.md'), ticketSource({ id: 'nested', status: 'open' }))

    const data = await loadTickets(projectDir, 'tickets')

    expect(data.projectDir).toBe(path.resolve(projectDir))
    expect(data.ticketsDir).toBe(path.resolve(projectDir, 'tickets'))
    expect(data.tickets.map((ticket) => ticket.id)).toEqual(['ticket-a', 'ticket-b'])
    expect(data.tickets.map((ticket) => path.basename(ticket.filePath))).toEqual(['a.md', 'b.md'])
  })

  test('parses tickets and derives stats, readiness, statuses, and graph data', async () => {
    const projectDir = await makeProject()

    await writeFile(
      path.join(projectDir, '.tickets', 'base.md'),
      ticketSource({
        id: 'base',
        title: 'Base work',
        status: 'closed',
        type: 'task',
        links: ['feature'],
        tags: ['foundation'],
      }),
    )
    await writeFile(
      path.join(projectDir, '.tickets', 'feature.md'),
      ticketSource(
        {
          id: 'feature',
          status: 'open',
          type: 'feature',
          parent: 'epic',
          deps: ['base'],
          priority: 2,
        },
        'Feature body',
      ),
    )
    await writeFile(
      path.join(projectDir, '.tickets', 'blocked.md'),
      ticketSource({
        id: 'blocked',
        status: 'open',
        deps: ['missing-ticket'],
      }),
    )

    const data = await loadTickets(projectDir)

    expect(data.tickets.map((ticket) => ticket.id)).toEqual(['base', 'blocked', 'feature'])
    expect(data.statuses).toEqual(['closed', 'open'])
    expect(data.stats).toEqual({
      total: 3,
      open: 2,
      closed: 1,
      ready: 1,
    })

    const byId = new Map(data.tickets.map((ticket) => [ticket.id, ticket]))
    expect(byId.get('base')).toMatchObject({
      title: 'Base work',
      body: 'Body text',
      isClosed: true,
      ready: false,
      unblocks: ['feature'],
      links: ['feature'],
      tags: ['foundation'],
    })
    expect(byId.get('feature')).toMatchObject({
      body: 'Feature body',
      parent: 'epic',
      priority: 2,
      blockedBy: ['base'],
      missingDeps: [],
      ready: true,
    })
    expect(byId.get('blocked')).toMatchObject({
      blockedBy: [],
      missingDeps: ['missing-ticket'],
      ready: false,
    })
    expect(data.graph.nodes.map((node) => node.id)).toEqual(['base', 'blocked', 'feature'])
    expect(data.graph.dependencyEdges.map((edge) => edge.id)).toEqual(['base->feature'])
  })

  test('resolves a custom tickets directory relative to the project directory', async () => {
    const projectDir = await makeProject()
    const customTicketsDir = 'work-items'

    await writeFile(path.join(projectDir, customTicketsDir, 'one.md'), ticketSource({ id: 'one', status: 'open' }))

    const data = await loadTickets(projectDir, customTicketsDir)

    expect(data.projectDir).toBe(path.resolve(projectDir))
    expect(data.ticketsDir).toBe(path.resolve(projectDir, customTicketsDir))
    expect(data.tickets).toHaveLength(1)
    expect(data.tickets[0]?.id).toBe('one')
  })
})
