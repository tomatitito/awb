---
id: awb-q8kd
status: closed
deps: []
links: [awb-jr4m]
created: 2026-04-18T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
tags: [graph, kanban, epic, filtering, ux]
---
# Tighten epic filtering and add an explicit without-epic option

Update the shared epic filter so selecting an epic shows only that epic and its direct children in both Graph and Kanban. Tickets without an epic should no longer remain visible implicitly. Instead, the UI should offer an explicit filter option for viewing tickets without an epic.

## Acceptance Criteria

- In Graph, selecting an epic shows only the epic ticket and its direct children.
- In Kanban, selecting an epic shows only the epic ticket and its direct children.
- Tickets without an epic are not included automatically when a specific epic is selected.
- The epic filter offers an explicit option for viewing only tickets without an epic.
- Tests cover both the narrowed epic filter behavior and the explicit without-epic option.

## Resolution

Implemented the shared filtering change for Graph and Kanban, added a `Without epic` selector option, updated graph expectations, and expanded test coverage.
