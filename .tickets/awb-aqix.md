---
id: awb-aqix
status: open
deps: [awb-8k2m]
links: [awb-3n5p]
created: 2026-04-18T22:03:17Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-3n5p
tags: [agent, runs, workflow, backend]
---
# Automatically update ticket status for agent run lifecycle

For ticket-backed agent runs, AWB transitions the ticket to `in_progress` when the run record is created. On successful completion, AWB transitions the ticket to `review`. Failed, aborted, or interrupted runs do not move the ticket to `review`; the ticket remains `in_progress`. On application restart, in-flight runs should be reconciled to `interrupted` or `failed` as appropriate. Concurrent runs for the same ticket are not supported and do not need special handling.

## Acceptance Criteria

- ticket-backed agent runs transition the ticket to `in_progress` when the run record is created
- successful run completion transitions the ticket to `review`
- failed, aborted, or interrupted runs do not transition the ticket to `review` and the ticket remains `in_progress`
- ticket markdown is updated on disk and AWB reloads the change
- concurrent runs for the same ticket are prevented rather than specially reconciled
- `bun test` succeeds
- `bun run build` succeeds

## Likely Touchpoints

- `src/agent/AgentController.ts`
- `src/agent/types.ts`
- `src/server.ts`
- `src/core/parseTicket.ts`
- `src/core/loadTickets.ts`
- `tests/agent/AgentController.test.ts`
- `tests/core/loadTickets.test.ts`

## Implementation Notes

- Add a ticket-status update path that rewrites the ticket markdown frontmatter on disk using the ticket file path already carried in `TicketRunContext`.
- The most natural integration point is server-side subscription to run lifecycle events from `AgentController`, so ticket status changes happen when `run-created` and `run-updated` events are emitted.
- Transition rules:
  - `run-created` for a ticket-backed run writes `status: in_progress`
  - `run-updated` with terminal `completed` writes `status: review`
  - `failed`, `aborted`, and future `interrupted` terminal states do not rewrite the ticket away from `in_progress`
- After each ticket file write, trigger an AWB reload deterministically rather than relying only on the filesystem watcher debounce.
- The current UI already prevents duplicate launches for the same ticket (`src/web/App.tsx`), but it may be worth adding a backend guard as well if we want the invariant enforced outside the browser.
- Restart reconciliation is not fully possible with the current in-memory-only run model from `awb-8k2m` / `awb-3n5p`. If strict post-restart `interrupted`/`failed` visibility is required in this ticket, it will need some form of persisted run state or shutdown/startup reconciliation hook. Otherwise, implement the ticket-status transitions now and treat restart reconciliation as follow-up work.
- Tests should cover status file rewrites for create, successful completion, and failed/aborted completion paths.

