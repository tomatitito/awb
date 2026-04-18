---
id: awb-3n5p
status: open
deps: []
links: [awb-by3k, awb-1gqe, awb-u4w8]
created: 2026-04-18T00:00:00Z
type: epic
priority: 1
assignee: Jens Kouros
tags: [agent, runs, background, ui, backend, workflow]
---
# Add background agent runs for ready tickets

Let users launch agent runs directly from ready tickets in Graph and Kanban without opening the current embedded agent panel. Runs should execute in the background, be visible in a dedicated Agents tab, and remain inspectable after completion.

This epic shifts AWB from a single panel-centric agent model toward a run-centric model where multiple agent runs can exist independently of the currently selected ticket.

## Scope

- launch background agent runs from ready tickets in Graph and Kanban
- support multiple agent runs in the AWB runtime and API model
- add an Agents tab for monitoring and inspection
- keep completed runs readable after they finish
- allow users to open a specific run and inspect its transcript/tool activity

## Out of Scope

- per-run git worktree isolation in the initial delivery (tracked separately)
- Glimpse-based visualization
- persistence across server restarts
- restarting completed runs from history
- launching multiple runs for the same ticket from the same button state

## Acceptance Criteria

- the work is split into child tickets covering architecture, launch UI, Agents tab/listing, run detail inspection, and deferred worktree planning
- ready tickets can launch background agent runs without opening the existing embedded agent panel by default
- the resulting UX supports inspecting active runs and reading completed run transcripts
- the implementation leaves room for future per-run git worktree metadata and richer run visualization without requiring either now
- `bun run build` succeeds for delivered work
