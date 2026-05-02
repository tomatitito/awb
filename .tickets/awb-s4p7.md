---
id: awb-s4p7
status: closed
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

## Notes

**2026-05-02T00:00:00Z**

Closed after child tickets completed the multi-project feature: discovery allowlist (`awb-k2h8`), safe runtime switching (`awb-n6q3`), desktop/mobile workspace selector (`awb-x1m5`), and docs/test polish (`awb-r4c2`).
