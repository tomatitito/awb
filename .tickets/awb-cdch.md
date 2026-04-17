---
id: awb-cdch
status: closed
deps: []
links: []
created: 2026-04-17T12:46:49Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-439e
---
# Add Bun tests for ticket parsing behavior

Add unit tests for src/core/parseTicket.ts covering tolerant frontmatter parsing, title/body extraction, filename fallback behavior, and array/string normalization for deps, links, and tags.

## Acceptance Criteria

- parseTicket is covered by Bun tests
- tests cover heading/title fallback behavior
- tests cover file-name/id fallback behavior
- tests cover deps/links/tags normalization from strings and arrays
- tests cover missing optional fields without throwing

