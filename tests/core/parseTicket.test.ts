import { describe, expect, test } from 'bun:test'
import { parseTicket } from '../../src/core/parseTicket.js'

describe('parseTicket', () => {
  test('reads supported frontmatter fields', () => {
    const ticket = parseTicket(
      '/workspace/.tickets/awb-1234.md',
      `---
id: awb-1234
title: Frontmatter title
status: in_progress
deps:
  - awb-dep1
  - 42
links:
  - https://example.com/spec
tags:
  - core
  - parser
type: task
priority: 3
assignee: Ada Lovelace
parent: awb-parent
created: "2026-04-17T12:46:35Z"
---
Body from markdown.
`,
    )

    expect(ticket).toEqual({
      id: 'awb-1234',
      title: 'Frontmatter title',
      body: 'Body from markdown.',
      status: 'in_progress',
      deps: ['awb-dep1', '42'],
      links: ['https://example.com/spec'],
      tags: ['core', 'parser'],
      type: 'task',
      priority: 3,
      assignee: 'Ada Lovelace',
      parent: 'awb-parent',
      created: '2026-04-17T12:46:35Z',
      filePath: '/workspace/.tickets/awb-1234.md',
    })
  })

  test('falls back to filename id and uses first markdown heading as title', () => {
    const ticket = parseTicket(
      '/workspace/.tickets/awb-fallback.md',
      `# Heading title

Body starts here.

## Details

More body.
`,
    )

    expect(ticket.id).toBe('awb-fallback')
    expect(ticket.title).toBe('Heading title')
    expect(ticket.body).toBe(`Body starts here.

## Details

More body.`)
  })

  test('trims body after removing the first heading', () => {
    const ticket = parseTicket(
      '/workspace/.tickets/trimmed.md',
      `

# Trimmed title

  Body keeps intentional indentation.

`,
    )

    expect(ticket.title).toBe('Trimmed title')
    expect(ticket.body).toBe('Body keeps intentional indentation.')
  })

  test('coerces scalar strings into array fields', () => {
    const ticket = parseTicket(
      '/workspace/.tickets/awb-scalars.md',
      `---
deps: awb-one
links: https://example.com/issue
tags: parser
---
# Scalar arrays
`,
    )

    expect(ticket.deps).toEqual(['awb-one'])
    expect(ticket.links).toEqual(['https://example.com/issue'])
    expect(ticket.tags).toEqual(['parser'])
  })

  test('keeps numeric priority values as numbers', () => {
    const ticket = parseTicket(
      '/workspace/.tickets/awb-priority.md',
      `---
priority: 5
---
# Priority
`,
    )

    expect(ticket.priority).toBe(5)
  })

  test('defaults missing optional fields and array fields', () => {
    const ticket = parseTicket('/workspace/.tickets/awb-minimal.md', '')

    expect(ticket).toEqual({
      id: 'awb-minimal',
      title: 'awb-minimal',
      body: '',
      deps: [],
      links: [],
      tags: [],
      filePath: '/workspace/.tickets/awb-minimal.md',
    })
  })
})
