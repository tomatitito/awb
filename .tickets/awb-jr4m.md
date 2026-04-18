---
id: awb-jr4m
status: closed
deps: []
links: []
created: 2026-04-18T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
---
# Filter kanban and graph by selected epic while leaving backlog and ungrouped tickets visible

Make epic selection a shared workspace filter that applies to both Kanban and Graph views. When an epic is selected, non-backlog Kanban columns and the Graph view should focus on the selected epic while tickets without an epic remain unaffected. The Kanban backlog column must remain unchanged.

## Acceptance Criteria

- Selecting an epic activates a shared filter state that persists when switching between Kanban and Graph views.
- In Kanban, when an epic is selected, all non-backlog columns show only:
  - the selected epic ticket,
  - tickets whose `parent` matches the selected epic id,
  - and tickets that do not belong to any epic.
- In Kanban, the backlog column is not filtered by the selected epic and continues to show its full contents.
- In Graph, when an epic is selected, the graph is reduced to the selected epic, its child tickets, and tickets that do not belong to any epic.
- Tickets without an epic remain visible and are not excluded by epic filtering.
- Clearing the epic selection restores the unfiltered Kanban and Graph views.
- Bun tests cover the epic-filtering behavior for Kanban and Graph, including backlog exceptions and tickets without an epic.

## Notes

- Do not model epic as a Kanban column; keep columns status-based and treat epic as a filter dimension.
- Reuse the existing epic filter model where possible instead of introducing a separate Kanban-only concept.
- The implementation should preserve current behavior when no epic is selected.
