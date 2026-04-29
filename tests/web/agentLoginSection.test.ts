import { describe, expect, test } from 'bun:test'
import { buildProgressMessageEntries } from '../../src/web/AgentLoginSection'

describe('buildProgressMessageEntries', () => {
  test('creates stable duplicate-aware keys without using array indexes directly', () => {
    expect(buildProgressMessageEntries(['sync', 'sync', 'done'])).toEqual([
      { key: 'sync:1', message: 'sync' },
      { key: 'sync:2', message: 'sync' },
      { key: 'done:1', message: 'done' },
    ])
  })
})
