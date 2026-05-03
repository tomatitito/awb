---
id: awb-z0vo
status: closed
deps: []
links: []
created: 2026-05-03T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
tags: [projects, startup, cli]
---
# Default startup project from the allowlisted project set

When AWB starts outside a project directory, it should choose a sensible initial project instead of failing against the current working directory.

## Acceptance Criteria

- `awb --dir <path>` always uses the explicitly selected project.
- Running `awb` inside a directory with `.tickets/` still uses the current working directory.
- Running `awb` elsewhere falls back to the first allowlisted project when one exists.
- AWB keeps the current error when no startup project can be resolved.
- The startup fallback is documented.

## Notes

**2026-05-03T12:05:00Z**

Updated CLI startup resolution so the working directory is only used when it actually contains `.tickets/` or when the user explicitly passed `--dir`. Otherwise AWB now loads the user project allowlist and starts in the first configured project. This avoids incorrect startup failures such as looking for tickets under `~/.config/.tickets`.
