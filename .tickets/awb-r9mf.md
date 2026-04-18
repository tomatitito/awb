---
id: awb-r9mf
status: closed
deps: []
links: [awb-b7ve, awb-jr4m]
created: 2026-04-18T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-6iak
tags: [mobile, graph, kanban, epic, filtering, responsive]
---
# Add epic selection controls to the mobile workspace

There is currently no way to select an epic on mobile, which blocks one of the most important navigation and focus workflows in AWB. Mobile users need a clear, accessible way to choose an epic filter so they can narrow both Graph and Kanban views without switching to a larger screen.

## Acceptance Criteria

- On mobile, users can open and change the shared epic filter without needing desktop-only UI.
- The mobile epic selector supports:
  - all tickets,
  - a specific epic,
  - tickets without an epic.
- The selected epic filter applies consistently to both Graph and Kanban on mobile.
- The current selection is visible in the mobile UI so users understand what scope they are viewing.
- The mobile interaction is usable alongside the existing single-focus workspace and does not require horizontal scrolling.
- Mobile regression coverage is added or updated for epic selection if appropriate.
- `bun run build` succeeds.

## Notes

- Reuse the existing shared epic filter state rather than introducing a mobile-only filter model.
- The control may live in a mobile filter sheet, header action, segmented flow, or another compact mobile affordance, but it must be obvious and quick to access.
- Consider how the control interacts with the current mobile navigation model and limited vertical space.
