---
id: awb-k7rl
status: open
deps: []
links: []
created: 2026-04-19T20:01:59Z
type: bug
priority: 1
assignee: Jens Kouros
tags: [ui, kanban, status]
---
# Normalize in_progress tickets into the Kanban in progress column

Kanban currently renders two separate columns for the in-progress state. One column labeled `in progress` appears between `open` and `closed` but is empty. A second column appears to the right of `closed` and contains tickets whose raw status is `in_progress` (underscore form), including the current ticket.

Expected behavior: tickets with raw status values like `in_progress` should be grouped into the canonical `in progress` Kanban column, and no duplicate extra column should be shown.

Likely cause: the Kanban grouping logic mixes normalized status values for ordering with raw ticket status values for the actual column key.

## Acceptance Criteria

- Kanban shows exactly one `in progress` column
- Tickets with status `in_progress` appear in the canonical `in progress` column between `open` and `closed`
- No duplicate extra in-progress column appears to the right of `closed`
- `bun run build` succeeds

