import { describe, expect, test } from 'bun:test'
import { deriveData, isClosedStatus } from '../../src/core/deriveData.js'
import type { Ticket } from '../../src/core/types.js'

function ticket(overrides: Partial<Ticket> & Pick<Ticket, 'id'>): Ticket {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    body: overrides.body ?? '',
    status: overrides.status,
    deps: overrides.deps ?? [],
    links: overrides.links ?? [],
    tags: overrides.tags ?? [],
    filePath: overrides.filePath ?? `.tickets/${overrides.id}.md`,
    created: overrides.created,
    type: overrides.type,
    priority: overrides.priority,
    assignee: overrides.assignee,
    parent: overrides.parent,
  }
}

describe('isClosedStatus', () => {
  test('normalizes known closed statuses', () => {
    expect(isClosedStatus('closed')).toBe(true)
    expect(isClosedStatus(' DONE ')).toBe(true)
    expect(isClosedStatus('Resolved')).toBe(true)
  })

  test('does not treat unknown, open, or missing statuses as closed', () => {
    expect(isClosedStatus('open')).toBe(false)
    expect(isClosedStatus('blocked')).toBe(false)
    expect(isClosedStatus('')).toBe(false)
    expect(isClosedStatus()).toBe(false)
  })
})

describe('deriveData', () => {
  test('derives dependencies, readiness, statuses, stats, and directory passthrough', () => {
    const data = deriveData('/repo/project', '/repo/project/.tickets', [
      ticket({ id: 'closed-a', status: ' closed ' }),
      ticket({ id: 'done-b', status: 'DONE' }),
      ticket({ id: 'ready-open', status: 'open', deps: ['closed-a', 'done-b'] }),
      ticket({ id: 'missing-dep', status: 'open', deps: ['closed-a', 'ghost-ticket'] }),
      ticket({ id: 'open-dep', status: 'open' }),
      ticket({ id: 'blocked-open', status: 'open', deps: ['open-dep'] }),
      ticket({ id: 'closed-ticket', status: 'resolved', deps: ['closed-a'] }),
      ticket({ id: 'unknown-status', deps: [] }),
      ticket({ id: 'custom-status', status: 'waiting', deps: [] }),
    ])

    const byId = new Map(data.tickets.map((derivedTicket) => [derivedTicket.id, derivedTicket]))

    expect(data.projectDir).toBe('/repo/project')
    expect(data.ticketsDir).toBe('/repo/project/.tickets')

    expect(byId.get('closed-a')).toMatchObject({
      isClosed: true,
      ready: false,
      blockedBy: [],
      missingDeps: [],
      unblocks: ['ready-open', 'missing-dep', 'closed-ticket'],
    })
    expect(byId.get('done-b')).toMatchObject({
      isClosed: true,
      ready: false,
      unblocks: ['ready-open'],
    })

    expect(byId.get('ready-open')).toMatchObject({
      isClosed: false,
      ready: true,
      blockedBy: ['closed-a', 'done-b'],
      missingDeps: [],
      unblocks: [],
    })
    expect(byId.get('missing-dep')).toMatchObject({
      ready: false,
      blockedBy: ['closed-a'],
      missingDeps: ['ghost-ticket'],
    })
    expect(byId.get('open-dep')).toMatchObject({
      isClosed: false,
      ready: true,
      blockedBy: [],
      missingDeps: [],
    })
    expect(byId.get('blocked-open')).toMatchObject({
      ready: false,
      blockedBy: ['open-dep'],
      missingDeps: [],
    })
    expect(byId.get('closed-ticket')).toMatchObject({
      isClosed: true,
      ready: false,
      blockedBy: ['closed-a'],
      missingDeps: [],
    })
    expect(byId.get('unknown-status')).toMatchObject({
      isClosed: false,
      ready: true,
      blockedBy: [],
      missingDeps: [],
    })

    expect(data.statuses).toEqual([' closed ', 'DONE', 'open', 'resolved', 'unknown', 'waiting'])
    expect(data.stats).toEqual({
      total: 9,
      open: 6,
      closed: 3,
      ready: 4,
    })
  })
})
