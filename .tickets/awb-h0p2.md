---
id: awb-h0p2
status: in progress
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
- Worktree lifecycle distinguishes run completion from workspace cleanup so successful runs remain inspectable after they finish
- Successful runs retain their worktrees by default instead of deleting them immediately on completion
- Cleanup removes the worktree directory and optionally deletes the dedicated branch only on failed runs or explicit user action
- Successful completed runs are not auto-cleaned and do not expire automatically
- The Agents UI exposes an action to open a retained run worktree in the configured editor on the user's local machine
- The editor is a general AWB setting, not a worktree-specific setting
- The editor command is configurable via project config file, `AWB_EDITOR`, and the `--editor` CLI flag
- Configuration precedence is: `--editor` overrides `AWB_EDITOR`, and `AWB_EDITOR` overrides the config file
- The editor configuration is a command string executed through a shell with the worktree path passed as the target
- There is no built-in default editor; when no editor is configured, AWB disables the action or surfaces a clear error explaining how to configure one
- Provisioning and cleanup failures are recorded in the run metadata and the run remains inspectable
- Transcript history and run inspection work regardless of whether the worktree still exists on disk
- Stale worktree detection on server startup handles orphaned .awb/worktrees/* directories
- Existing shared-project runs continue to work unchanged
- bun run build succeeds
- bun test passes

## Notes

**2026-04-29T12:45:00Z**

Implemented worktree-per-run execution behind the project config flag `agentRuns.worktreeIsolation`. Added startup stale-worktree reconciliation, git worktree provisioning/cleanup, editor command resolution (`--editor` > `AWB_EDITOR` > `.awb/config.json`), server endpoints for opening and cleaning run worktrees, and Agents UI controls for retained worktrees. Successful runs retain their worktrees by default; failed runs are auto-cleaned while remaining inspectable. Verified with `bun test` and `bun run build`.

