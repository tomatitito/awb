# Deferred design: per-run git worktree isolation

Related tickets:

- `awb-u4w8` — investigate per-run git worktree isolation for agent runs
- `awb-3n5p` — background agent runs epic
- `awb-8k2m` — multi-run agent architecture
- `awb-p9t2` — run inspection in the Agents tab

## Goal

Document the likely worktree model for future AWB background agent runs without making worktrees a prerequisite for the first multi-run release.

The v1 architecture should keep shipping with all runs using the shared project checkout, while carrying enough metadata to add isolated git worktrees later.

## Non-goal for v1

AWB does **not** need to create or clean up git worktrees in the initial background-run delivery.

That means the initial launch UI, Agents tab, transcript inspection, and parallel run model must continue to work when `run.worktree.mode === "shared-project"` and `run.worktree.status === "not-requested"`.

## Likely model

The most likely future design is **one git worktree per agent run**:

1. user launches a background run for a ticket
2. AWB allocates a run id first
3. if worktree isolation is enabled, AWB creates a dedicated branch and `git worktree`
4. the agent session starts with its cwd set to that worktree path instead of the main project root
5. run inspection continues to read transcript and tool activity from the run record, independent of whether the run used the shared checkout or a worktree
6. after the run finishes, AWB keeps the run history even if the worktree is later cleaned up

This keeps filesystem isolation aligned with run identity and makes future parallel execution safer.

## Why worktree-per-run is the likely direction

A per-run worktree:

- avoids multiple active runs editing the same checkout concurrently
- keeps uncommitted changes attributable to a single run
- makes cleanup and recovery a run-scoped operation
- allows future "open this run's checkout" and "diff this run" workflows
- fits the existing AWB run model, where each run already has a stable id, transcript, timestamps, and tool history

## Required run metadata

The run model should carry worktree metadata even before AWB provisions real worktrees.

Recommended fields:

- `mode`: whether the run used the shared project checkout or a dedicated git worktree
  - expected values: `shared-project`, `git-worktree`
- `status`: worktree lifecycle state
  - expected values: `not-requested`, `provisioning`, `ready`, `cleanup-pending`, `cleaning`, `cleaned`, `failed`
- `path`: absolute filesystem path for the worktree when provisioned
- `branch`: dedicated branch name for the run
- `baseRef`: git ref the worktree was created from, such as `main`, `HEAD`, or a configured branch
- `headSha`: commit sha captured when the worktree was created or last reconciled
- `createdAt`: timestamp when the worktree became usable
- `lastCheckedAt`: timestamp of the last successful existence/reconciliation check
- `cleanupStartedAt`: timestamp when cleanup began
- `cleanedAt`: timestamp when cleanup completed
- `cleanupError`: the last cleanup/provisioning failure message, if any

These fields are enough to support future provisioning, diagnostics, and cleanup without changing the core run identity model.

## Naming model

The naming scheme should be deterministic and run-derived.

Likely conventions:

- worktree directory: `<project>/.awb/worktrees/<run-id>`
- branch name: `awb/run/<run-id>`
- optional human label: append a sanitized ticket id for readability, for example `awb/run/<run-id>-<ticket-id>`

Guidelines:

- prefer the run id as the canonical unique key
- ticket ids may repeat across reruns, so they should not be the only unique component
- branch names should remain short enough for normal git tooling
- avoid embedding mutable ticket titles in canonical paths

## Creation flow

If and when worktrees are enabled, the future flow should likely be:

1. create the run record first
2. mark `worktree.mode = "git-worktree"` and `worktree.status = "provisioning"`
3. resolve the base ref
4. create a branch for the run
5. create the git worktree on disk
6. verify the path exists and capture `headSha`
7. update the run to `worktree.status = "ready"`
8. start the agent session with `cwd = worktree.path`

Why create the run record first:

- provisioning failures can still be attached to a visible run
- the run can surface errors in the Agents tab
- transcript history stays attached to the run id even if the agent never starts successfully

## Cleanup model

Cleanup should be decoupled from transcript/history retention.

Recommended behavior:

- keep run metadata and transcript history in AWB even after worktree cleanup
- treat cleanup as a separate lifecycle step from run completion
- allow cleanup to happen immediately, lazily, or via a future janitor pass

Likely cleanup triggers:

- after run completion, failure, or abort
- on explicit user action in future UI
- on server startup via stale-worktree reconciliation

Likely cleanup steps:

1. mark `worktree.status = "cleanup-pending"`
2. stop any live session tied to that worktree
3. remove the worktree directory with `git worktree remove`
4. optionally delete the dedicated branch when policy allows it
5. mark `worktree.status = "cleaned"` and set `cleanedAt`

## Failure and crash scenarios

The design must account for partial failures.

### Provisioning fails before the agent starts

Expected outcome:

- run remains visible
- run status becomes `failed`
- worktree status becomes `failed`
- error is stored in `lastError` and/or `worktree.cleanupError`
- transcript can still include an error entry explaining what failed

### Agent run crashes after worktree creation

Expected outcome:

- transcript and run inspection remain available
- worktree metadata still points to the created checkout
- cleanup can be retried later

### AWB server crashes mid-run

Expected outcome for v1 planning:

- persistence is still out of scope
- on restart, any leftover `.awb/worktrees/*` directories are treated as stale candidates for future reconciliation tooling
- future janitor logic should detect orphaned worktrees that no longer have an in-memory run owner

### Cleanup fails

Expected outcome:

- run stays inspectable
- worktree status remains `failed` or `cleanup-pending`
- `cleanupError` records the failure
- retrying cleanup later remains possible

## Interaction with transcript history and run inspection

Transcript history must remain run-centric, not filesystem-centric.

That means:

- the transcript belongs to the run record whether the run used the shared checkout or a dedicated worktree
- the Agents tab should inspect run history without requiring the worktree to still exist
- future UI can show worktree metadata as run diagnostics, not as the primary source of truth

This prevents cleanup from destroying inspection history.

## Interaction with future parallel execution

Worktree isolation is especially valuable once multiple runs can execute concurrently.

With dedicated worktrees, AWB can later support:

- multiple active runs against the same repo without shared-checkout conflicts
- rerunning the same ticket in a fresh checkout
- opening or diffing a specific run's changes
- future policies like max active worktrees or disk-budget cleanup

But none of those should be required for the initial multi-run release.

## Implementation guidance for current tickets

Current tickets should assume:

- background runs ship first
- the initial runtime can use the shared project checkout
- `run.worktree` metadata exists now as scaffolding
- UI should tolerate `shared-project/not-requested`
- no current agent-run ticket should block on git worktree creation, branch management, or cleanup automation

In short: **design for worktrees now, implement them later.**
