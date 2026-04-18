---
id: awb-8k2m
status: closed
deps: []
links: [awb-3n5p]
created: 2026-04-18T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-3n5p
tags: [agent, runs, backend, api, architecture]
---
# Define multi-run agent architecture for AWB

The current agent integration is single-session and panel-centric. AWB needs a run-centric model that can manage multiple concurrent background agent runs independently of the currently selected ticket.

This ticket defines and implements the backend and API foundations for agent runs so later UI work can create, list, inspect, and interact with specific runs.

## Scope

- replace or refactor the current single-session agent controller model into a multi-run model
- define a stable run identity and lifecycle for queued, starting, running, completed, failed, and aborted runs
- define run creation around ticket-backed background runs rather than a single global selected-ticket context
- create runs from ticket context and immediately start them with a server-generated default prompt
- embed the ticket id, title, file path, and body directly into the generated initial prompt
- use a default initial prompt that instructs the agent to use red/green TDD to implement the ticket
- expose API endpoints and/or event streams for creating, listing, inspecting, prompting, and aborting individual runs
- retain active and completed runs in memory while the AWB server remains active
- leave room in the model for future worktree metadata without implementing worktrees now

## Acceptance Criteria

- backend supports multiple agent runs instead of a single global session
- each run has a stable id plus ticket context, status, timestamps, transcript history, and tool activity history
- runs can be listed and looked up individually
- active and completed runs remain available while the server is running
- creating a run is ticket-based and immediately starts the run rather than creating an empty global session
- the backend generates a default initial prompt for new runs that embeds the ticket content directly
- the default initial prompt instructs the agent to use red/green TDD to implement the ticket
- API shape is implemented or clearly defined for:
  - creating a run for a ticket
  - listing runs
  - fetching or streaming run updates
  - sending a follow-up prompt to a run
  - aborting a run
- the design leaves room for future per-run git worktree metadata without requiring it now
- `bun run build` succeeds

## Likely Touchpoints

- `src/agent/AgentController.ts`
- `src/agent/types.ts`
- `src/server.ts`
- `src/web/agentApi.ts`
