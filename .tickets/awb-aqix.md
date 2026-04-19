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

When a ticket-backed agent run starts, AWB should move the ticket to in_progress. When a run completes successfully, AWB should move the ticket to review. This should be implemented on top of the run-centric agent architecture and define behavior for failed/aborted runs and concurrent runs on the same ticket.

## Acceptance Criteria

- ticket-backed agent runs transition the ticket to in_progress when the run actually starts
- successful run completion transitions the ticket to review
- failed or aborted runs do not transition the ticket to review
- ticket markdown is updated on disk and AWB reloads the change
- behavior is defined for multiple runs targeting the same ticket
- bun test succeeds
- bun run build succeeds

