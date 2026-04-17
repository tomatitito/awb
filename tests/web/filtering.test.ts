import { describe, expect, test } from 'bun:test'
import type { DerivedTicket } from '../../src/core/types'
import {
  createDefaultSidebarFilters,
  getAvailableStatuses,
  getEpicTickets,
  getVisibleTickets,
  normalizeFilterValue,
  type SidebarFilters,
} from '../../src/web/filtering'

function ticket(overrides: Partial<DerivedTicket> & { id: string }): DerivedTicket {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    body: overrides.body ?? '',
    status: overrides.status,
    deps: overrides.deps ?? [],
    links: overrides.links ?? [],
    type: overrides.type,
    priority: overrides.priority,
    assignee: overrides.assignee,
    parent: overrides.parent,
    tags: overrides.tags ?? [],
    filePath: overrides.filePath ?? `/tickets/${overrides.id}.md`,
    blockedBy: overrides.blockedBy ?? [],
    unblocks: overrides.unblocks ?? [],
    ready: overrides.ready ?? false,
    missingDeps: overrides.missingDeps ?? [],
    isClosed: overrides.isClosed ?? false,
    created: overrides.created,
  }
}

describe('sidebar filtering', () => {
  test('creates default filters with no restrictions', () => {
    expect(createDefaultSidebarFilters()).toEqual({
      statuses: [],
      linkedOnly: false,
      dependentOnly: false,
      epicId: '',
    })
  })

  test('normalizes filter values for case-insensitive comparisons', () => {
    expect(normalizeFilterValue()).toBe('unknown')
    expect(normalizeFilterValue('')).toBe('unknown')
    expect(normalizeFilterValue('  In Progress  ')).toBe('in progress')
    expect(normalizeFilterValue('   ')).toBe('')
  })

  test('extracts epics and sorts them by id', () => {
    const tickets = [
      ticket({ id: 'story-1', type: 'story' }),
      ticket({ id: 'epic-b', type: 'EPIC' }),
      ticket({ id: 'epic-a', type: 'epic' }),
      ticket({ id: 'task-1' }),
    ]

    expect(getEpicTickets(tickets).map((item) => item.id)).toEqual(['epic-a', 'epic-b'])
  })

  test('returns unique available statuses and uses unknown for missing status', () => {
    const tickets = [
      ticket({ id: 'a', status: 'open' }),
      ticket({ id: 'b', status: 'closed' }),
      ticket({ id: 'c', status: 'open' }),
      ticket({ id: 'd' }),
    ]

    expect(getAvailableStatuses(tickets)).toEqual(['open', 'closed', 'unknown'])
  })

  test('filters visible tickets by selected statuses', () => {
    const tickets = [
      ticket({ id: 'a', status: 'open' }),
      ticket({ id: 'b', status: 'In Progress' }),
      ticket({ id: 'c', status: 'closed' }),
      ticket({ id: 'd' }),
    ]
    const filters: SidebarFilters = {
      ...createDefaultSidebarFilters(),
      statuses: ['OPEN', 'in progress'],
    }

    expect(getVisibleTickets(tickets, undefined, filters).map((item) => item.id)).toEqual(['a', 'b'])
  })

  test('filters visible tickets to an epic and its direct children', () => {
    const tickets = [
      ticket({ id: 'epic-a', type: 'epic' }),
      ticket({ id: 'child-a', parent: 'epic-a' }),
      ticket({ id: 'child-b', parent: 'epic-b' }),
      ticket({ id: 'unrelated' }),
    ]
    const filters: SidebarFilters = {
      ...createDefaultSidebarFilters(),
      epicId: 'epic-a',
    }

    expect(getVisibleTickets(tickets, undefined, filters).map((item) => item.id)).toEqual(['epic-a', 'child-a'])
  })

  test('filters visible tickets to links from the selected ticket', () => {
    const selected = ticket({ id: 'selected', links: ['linked-b', 'linked-a'] })
    const tickets = [ticket({ id: 'linked-a' }), ticket({ id: 'unlinked' }), ticket({ id: 'linked-b' })]
    const filters: SidebarFilters = {
      ...createDefaultSidebarFilters(),
      linkedOnly: true,
    }

    expect(getVisibleTickets(tickets, selected, filters).map((item) => item.id)).toEqual(['linked-a', 'linked-b'])
  })

  test('filters visible tickets to dependencies and dependents of the selected ticket', () => {
    const selected = ticket({ id: 'selected', blockedBy: ['dependency'], unblocks: ['dependent'] })
    const tickets = [ticket({ id: 'dependency' }), ticket({ id: 'unrelated' }), ticket({ id: 'dependent' })]
    const filters: SidebarFilters = {
      ...createDefaultSidebarFilters(),
      dependentOnly: true,
    }

    expect(getVisibleTickets(tickets, selected, filters).map((item) => item.id)).toEqual(['dependency', 'dependent'])
  })
})
