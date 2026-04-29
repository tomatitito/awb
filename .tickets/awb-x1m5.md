---
id: awb-x1m5
status: open
deps: [awb-n6q3]
links: []
created: 2026-04-29T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-s4p7
tags: [projects, ui, header, mobile, desktop]
---
# Add a project selector to the workspace header

Replace the static project path display with a selector that shows the active project and lets the user switch projects from the UI.

## Acceptance Criteria

- Desktop topbar shows the active project and offers a selector control.
- Mobile header provides an equivalent way to view and change the active project.
- The selector makes it clear which project is currently active.
- Long paths are handled without breaking layout.
- Loading and error states are visible while a switch is in progress or fails.
- Existing search, filters, and agent controls continue to behave correctly around the new control.

## Notes

- Keep the full path accessible even if the visible label is shortened.
- The first version can be a dropdown/popover/list; project search can be a follow-up if needed.
