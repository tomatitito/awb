---
id: awb-u4w8
status: closed
deps: [awb-8k2m]
links: [awb-3n5p, awb-p9t2, awb-h0p2]
created: 2026-04-18T00:00:00Z
type: task
priority: 3
assignee: Jens Kouros
parent: awb-3n5p
tags: [agent, runs, git, worktree, deferred]
---
# Investigate per-run git worktree isolation for agent runs

AWB will likely want each background agent run to operate in its own isolated git worktree eventually, but that should not block the initial multi-run architecture, launch UI, or Agents tab workflow.

This ticket is intentionally deferred. Its purpose is to define the likely worktree model, required metadata, lifecycle, and cleanup behavior so the first version of agent runs does not paint AWB into a corner.

## Scope

- document how an agent run could map to a dedicated git worktree
- identify the metadata the run model would need to carry for future worktree support
- identify creation, naming, cleanup, and failure-mode concerns
- clarify how worktree isolation would interact with transcript history, run inspection, and future parallel execution workflows

## Acceptance Criteria

- the likely worktree-per-run approach is documented clearly enough to guide later implementation
- required run metadata for future worktree support is identified
- lifecycle and cleanup concerns are identified, including failure and crash scenarios
- the deferred design does not block the initial agent-run tickets from shipping without worktrees

## Notes

**2026-04-21T12:30:00Z**

Used red/green TDD to add worktree-planning scaffolding to the run model. Added `AgentRunWorktreeState` with explicit deferred statuses and defaulted new runs to `shared-project/not-requested` so current multi-run work can ship without worktree provisioning. Documented the future worktree-per-run design, required metadata, naming, lifecycle, cleanup, and crash/failure handling in `wiki/agent-run-worktree-isolation.md`. Verified with `bun test` and `bun run build`.
