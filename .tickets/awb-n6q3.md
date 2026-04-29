---
id: awb-n6q3
status: open
deps: [awb-k2h8]
links: []
created: 2026-04-29T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-s4p7
tags: [projects, backend, server, state]
---
# Support switching the active project at runtime

Refactor the server-side project state so AWB can swap its active `projectDir` and `ticketsDir` while running.

## Acceptance Criteria

- AWB exposes a way for the UI to fetch available projects and switch the active one.
- Switching projects reloads tickets, statuses, graph data, and settings for the newly selected project.
- File watching is re-bound to the newly active tickets directory.
- Agent-related project state is either reinitialized safely for the new project or explicitly disabled during switching with clear UX.
- Failed switches leave the current project usable and surface a clear error.
- Automated tests cover successful and failed project switching.

## Notes

- Today `startServer()` and related controllers are initialized around a single immutable `projectDir`; that assumption will need to change.
- Pay special attention to watcher cleanup and project-scoped agent/session/worktree state.
