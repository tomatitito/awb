---
id: awb-s4p7
status: open
deps: []
links: []
created: 2026-04-29T00:00:00Z
type: epic
priority: 1
assignee: Jens Kouros
tags: [projects, multi-project, navigation, configuration]
---
# Add dynamic project selection to AWB

Allow AWB to switch between multiple ticket directories from within the running app instead of requiring a restart with `--dir`.

## Acceptance Criteria

- The project-switching work is broken down into child tickets.
- The chosen discovery model for selectable projects is defined.
- AWB can switch project context safely without requiring a full app restart.
- The active project is visible and changeable from the workspace header.
- Tests and documentation cover the new behavior.
