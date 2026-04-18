---
id: tv-cdsg
status: closed
deps: [tv-layr]
links: [tv-gd42, tv-layr, tv-rlnk]
created: 2026-04-14T00:00:00Z
type: task
priority: 3
assignee: Jens Kouros
parent: tv-gd42
tags: [ui, graph, polish]
---
# Polish graph controls and ticket card presentation

Refine the redesigned Graph mode so the controls and card presentation are consistent and readable. This ticket owns the exact presentation defaults for direction controls, critical-path controls, card formatting, epic labeling, title truncation, and selected-ticket related-link reveal styling.

## Acceptance Criteria

- Graph mode defaults to a left-to-right layout.
- Users can switch layout direction between left-to-right and top-to-bottom with clear controls.
- Users can toggle critical path highlighting on and off with clear controls.
- Ticket cards show id, title, status, and epic context in a compact readable format.
- Card titles are limited to two lines.
- Child tickets show epic context by epic id, and epic tickets show an explicit Epic indicator.
- Selecting a ticket reveals its non-dependency related links and subtly emphasizes the related tickets without competing with dependency ordering.
- The accepted presentation defaults are documented clearly enough that future graph work can reuse them without re-deciding UI details.
