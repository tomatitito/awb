---
id: awb-b4e2
status: closed
deps: []
links: []
created: 2026-04-17T13:41:54Z
type: feature
priority: 2
assignee: Jens Kouros
tags: [kanban, ui, tickets]
---
# Add backlog column for non-ready open tickets

Update the Kanban view so open tickets that are not marked ready appear in a separate leftmost Backlog column. The column order should become backlog, open, in progress, closed.

## Acceptance Criteria

- Kanban shows a leftmost Backlog column\n- open tickets that are not ready render in Backlog instead of Open\n- ready open tickets remain in Open\n- column order is backlog, open, in progress, closed\n- bun run build succeeds

