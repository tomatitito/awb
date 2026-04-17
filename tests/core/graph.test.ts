import { describe, expect, test } from 'bun:test'

import { deriveGraph, deriveVisibleGraph } from '../../src/core/graph.js'
import type { DerivedTicket } from '../../src/core/types.js'

function ticket(overrides: Partial<DerivedTicket> & Pick<DerivedTicket, 'id'>): DerivedTicket {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    body: overrides.body ?? '',
    status: overrides.status ?? 'open',
    deps: overrides.deps ?? overrides.blockedBy ?? [],
    links: overrides.links ?? [],
    tags: overrides.tags ?? [],
    filePath: overrides.filePath ?? `.tickets/${overrides.id}.md`,
    blockedBy: overrides.blockedBy ?? [],
    unblocks: overrides.unblocks ?? [],
    ready: overrides.ready ?? false,
    missingDeps: overrides.missingDeps ?? [],
    isClosed: overrides.isClosed ?? false,
    created: overrides.created,
    type: overrides.type,
    priority: overrides.priority,
    assignee: overrides.assignee,
    parent: overrides.parent,
  }
}

describe('deriveGraph', () => {
  test('derives deterministic layers and transitive-reduced dependency edges', () => {
    const graph = deriveGraph([
      ticket({ id: 'task-d', blockedBy: ['task-c', 'task-a'] }),
      ticket({ id: 'task-b' }),
      ticket({ id: 'task-c', blockedBy: ['task-b', 'task-a', 'missing-ticket', 'task-a'] }),
      ticket({ id: 'task-a' }),
    ])

    expect(graph.hasCycle).toBe(false)
    expect(graph.nodes).toEqual([
      { id: 'task-a', layer: 0, order: 0, critical: true },
      { id: 'task-b', layer: 0, order: 1, critical: false },
      { id: 'task-c', layer: 1, order: 0, critical: true },
      { id: 'task-d', layer: 2, order: 0, critical: true },
    ])
    expect(graph.dependencyEdges).toEqual([
      { id: 'task-a->task-c', source: 'task-a', target: 'task-c', isCritical: true },
      { id: 'task-b->task-c', source: 'task-b', target: 'task-c', isCritical: false },
      { id: 'task-c->task-d', source: 'task-c', target: 'task-d', isCritical: true },
    ])
    expect(graph.criticalPath).toEqual({
      nodeIds: ['task-a', 'task-c', 'task-d'],
      edgeIds: ['task-a->task-c', 'task-c->task-d'],
      length: 2,
    })
  })

  test('reports cycles instead of deriving a partial layout', () => {
    const graph = deriveGraph([
      ticket({ id: 'task-c', blockedBy: ['task-b'] }),
      ticket({ id: 'task-a', blockedBy: ['task-c'] }),
      ticket({ id: 'task-b', blockedBy: ['task-a'] }),
    ])

    expect(graph).toEqual({
      hasCycle: true,
      cycle: {
        nodeIds: ['task-a', 'task-b', 'task-c', 'task-a'],
        edgeIds: ['task-a->task-b', 'task-b->task-c', 'task-c->task-a'],
      },
      nodes: [],
      dependencyEdges: [],
      criticalPath: {
        nodeIds: [],
        edgeIds: [],
        length: 0,
      },
    })
  })
})

describe('deriveVisibleGraph', () => {
  test('filters nodes, dependency edges, and critical path to visible tickets', () => {
    const tickets = [
      ticket({ id: 'task-a' }),
      ticket({ id: 'task-b', blockedBy: ['task-a'] }),
      ticket({ id: 'task-c', blockedBy: ['task-b'] }),
      ticket({ id: 'task-d', blockedBy: ['task-c'] }),
    ]
    const graph = deriveGraph(tickets)

    const visible = deriveVisibleGraph(graph, [tickets[1], tickets[2]], tickets[1])

    expect(visible.hasCycle).toBe(false)
    expect(visible.nodes).toEqual([
      { id: 'task-b', layer: 1, order: 0, critical: true },
      { id: 'task-c', layer: 2, order: 0, critical: true },
    ])
    expect(visible.dependencyEdges).toEqual([
      { id: 'task-b->task-c', source: 'task-b', target: 'task-c', isCritical: true },
    ])
    expect(visible.criticalPath).toEqual({
      nodeIds: ['task-b', 'task-c'],
      edgeIds: ['task-b->task-c'],
      length: 3,
    })
  })

  test('adds selected related links but excludes dependencies and dependents', () => {
    const selected = ticket({
      id: 'task-b',
      blockedBy: ['task-a'],
      unblocks: ['task-c'],
      links: ['task-c', 'task-e', 'task-a', 'task-b', 'task-d'],
    })
    const tickets = [
      ticket({ id: 'task-a' }),
      selected,
      ticket({ id: 'task-c', blockedBy: ['task-b'] }),
      ticket({ id: 'task-d' }),
      ticket({ id: 'task-e' }),
    ]
    const graph = deriveGraph(tickets)

    const visible = deriveVisibleGraph(graph, tickets, selected)

    expect(visible.relatedEdges).toEqual([
      { id: 'task-b~>task-d', source: 'task-b', target: 'task-d' },
      { id: 'task-b~>task-e', source: 'task-b', target: 'task-e' },
    ])
  })

  test('preserves cycle state for visible graph derivation', () => {
    const graph = deriveGraph([
      ticket({ id: 'task-a', blockedBy: ['task-b'] }),
      ticket({ id: 'task-b', blockedBy: ['task-a'] }),
    ])

    const visible = deriveVisibleGraph(graph, [ticket({ id: 'task-a' })])

    expect(visible).toEqual({
      hasCycle: true,
      cycle: graph.cycle,
      nodes: [],
      dependencyEdges: [],
      relatedEdges: [],
      criticalPath: graph.criticalPath,
    })
  })
})
