---
id: awb-ar1t
status: closed
deps: []
links: []
created: 2026-04-17T12:46:49Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-439e
---
# Add Bun tests for filtering and file-based ticket loading

Add tests for src/web/filtering.ts and src/core/loadTickets.ts covering status/epic/relation filters, available statuses, epic sorting, file loading from temp ticket directories, deterministic ordering, and integration with parsing/derived data.

## Acceptance Criteria

- filtering helpers are covered by Bun tests
- tests cover status, epic, linked-only, and dependent-only filters
- tests cover getEpicTickets sorting and getAvailableStatuses behavior
- loadTickets is tested against temporary ticket directories
- tests verify deterministic ordering and integrated parse/derive results

