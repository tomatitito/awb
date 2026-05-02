---
id: awb-n6q3
status: closed
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

## Notes

**2026-04-29T14:35:00Z**

Used red/green TDD with `tests/server.projectSwitch.test.ts` to cover successful and failed project switching. Refactored `src/server.ts` to maintain mutable runtime project state, rebind the file watcher when switching, and reinitialize the project-scoped `AgentController` for the newly active project. Added `POST /api/projects/switch` alongside the existing `/api/projects` discovery endpoint, plus client helpers in `src/web/agentApi.ts` so the UI can fetch and switch projects later. The switch flow validates against the user-level allowlist, reloads tickets/graph data from the new project, closes stale per-run SSE streams, and keeps the current project intact on failure. Verified with `bun test`, `bun run check --max-diagnostics=20`, and `bun run build:node`. Note: `bun run build` is currently blocked in this environment by an `esbuild` process being killed while Vite loads config, which appears unrelated to the server-side project switching changes.
