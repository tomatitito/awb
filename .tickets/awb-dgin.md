---
id: awb-dgin
status: open
deps: [awb-hjm7]
links: []
created: 2026-04-17T20:55:47Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-6iak
tags: [ui, responsive, layout, mobile, kanban]
---
# Implement one-column swipeable mobile Kanban view

Implement a dedicated mobile Kanban experience for AWB. On phone-sized screens, Kanban should show one column at a time instead of the desktop multi-column board, with navigation that supports swipe gestures and/or explicit next/previous controls.

The mobile Kanban should keep card selection readable and touch-friendly while preserving intentional horizontal interaction only within the Kanban view.

## Acceptance Criteria

- on phone-sized screens, Kanban shows one column at a time
- users can move between Kanban columns with swipe and/or explicit controls
- column position/state is communicated clearly, such as current column name and count
- Kanban cards remain readable and easy to tap on phone-sized screens
- horizontal overflow is intentional and constrained to the Kanban interaction model
- bun run build succeeds

