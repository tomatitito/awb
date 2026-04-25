---
id: awb-h0p2
status: open
deps: [awb-u4w8]
links: [awb-u4w8]
created: 2026-04-21T21:48:49Z
type: task
priority: 3
assignee: Jens Kouros
parent: awb-3n5p
tags: [agent, runs, git, worktree]
---
# Implement per-run git worktree isolation for agent runs

Implement the worktree-per-run design documented in wiki/agent-run-worktree-isolation.md. The investigation ticket (awb-u4w8) defined the model, metadata, naming, lifecycle, cleanup, and failure handling. This ticket covers the actual implementation.

## Acceptance Criteria

- AWB creates a dedicated git worktree per agent run when worktree isolation is enabled
- Worktree naming follows the documented convention: .awb/worktrees/<run-id> with branch awb/run/<run-id>
- Creation flow: run record first, then provision worktree, then start agent session with cwd set to worktree path
- Worktree lifecycle transitions (provisioning → ready → cleanup-pending → cleaning → cleaned) are tracked on the run record
- Cleanup removes the worktree directory and optionally deletes the dedicated branch after run completion, failure, or abort
- Provisioning and cleanup failures are recorded in the run metadata and the run remains inspectable
- Transcript history and run inspection work regardless of whether the worktree still exists on disk
- Stale worktree detection on server startup handles orphaned .awb/worktrees/* directories
- Existing shared-project runs continue to work unchanged
- bun run build succeeds
- bun test passes

