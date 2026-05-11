# Durable agent conversation resume storage

Related tickets:

- `awb-vf2e` - design durable agent conversation resume storage
- `awb-3h5e` - resume and persist agent conversations
- `awb-s0fx` - persist agent run metadata and transcripts on disk
- `awb-9x9b` - reopen a persisted pi session for follow-up prompts

## Goal

Persist enough AWB-owned run state to list, inspect, and resume agent conversations after an AWB server restart without taking ownership of pi's session file format.

The pi SDK remains the source of truth for LLM conversation context. AWB persists the run registry, UI transcript projection, worktree state, and the pointer to the pi session file.

## Storage layout

Use one JSON file per AWB run:

```text
<project>/.awb/
  agent-runs/
    <run-id>.json
  pi-sessions/
    <timestamp>_<pi-session-id>.jsonl
```

Per-run files are preferred over a single registry file because runs update independently, partial write recovery is run-scoped, and startup can rebuild run order by scanning `createdAt`/`updatedAt`.

The pi session JSONL files stay under `.awb/pi-sessions/` and keep their current pi-owned append-only format. AWB should not rewrite or migrate those files except by opening them through the pi SDK.

## Run file format

Each `.awb/agent-runs/<run-id>.json` stores a versioned snapshot:

```json
{
  "storageVersion": 1,
  "projectDir": "/abs/project",
  "run": {
    "id": "run-id",
    "context": { "kind": "ticket", "ticketId": "awb-123", "title": "...", "body": "...", "filePath": ".tickets/awb-123.md" },
    "status": "completed",
    "createdAt": 1778490000000,
    "startedAt": 1778490001000,
    "completedAt": 1778490300000,
    "updatedAt": 1778490300000,
    "transcript": {
      "runId": "run-id",
      "initialPrompt": "...",
      "entries": [],
      "toolActivity": [],
      "updatedAt": 1778490300000
    },
    "queuedSteeringCount": 0,
    "queuedFollowUpCount": 0,
    "sessionId": "pi-session-id",
    "sessionFile": "/abs/project/.awb/pi-sessions/...",
    "model": { "provider": "openai", "id": "..." },
    "lastError": null,
    "worktree": { "mode": "shared-project", "status": "not-requested" }
  },
  "resume": {
    "state": "available",
    "lastCheckedAt": 1778490300000,
    "error": null
  }
}
```

Persist AWB metadata separately from pi:

- run identity, context, lifecycle status, timestamps, queued prompt counters, model, and last error
- normalized transcript entries and tool activity used by the AWB UI
- `sessionId` and absolute `sessionFile` pointer to the pi JSONL file
- worktree mode/status/path/branch/base/head/cleanup metadata
- resume health state computed from the run file and the pi session file

Do not persist live SDK objects, event listeners, pending Promises, or an active `AgentSession`. Those are process-local and must be recreated on demand.

## Write behavior

Write run files with whole-file atomic replacement:

1. serialize the complete run snapshot to `<run-id>.json.tmp-<pid>-<nonce>`
2. write and close the temp file
3. rename it over `<run-id>.json`
4. ignore orphaned temp files on startup

The implementation should debounce high-frequency transcript updates if needed, but terminal status transitions, user prompt entries, tool starts/ends, `sessionFile`, and worktree state changes must be flushed before returning from the API handler or before reporting the final run state.

## Startup and migration defaults

On startup:

- if `.awb/agent-runs/` does not exist, create it lazily and start with an empty run list
- if a run file has no `storageVersion`, treat it as version 0 and migrate by filling missing optional fields
- default missing `queuedSteeringCount` and `queuedFollowUpCount` to `0`
- default missing `worktree` to `{ "mode": "shared-project", "status": "not-requested" }`
- default missing `resume` by checking `run.sessionFile`
- if a run was persisted as `queued`, `starting`, or `running`, load it as `failed` with `lastError = "AWB stopped before this run completed."` unless a future scheduler explicitly supports process restart continuation

Existing `.awb/pi-sessions/*.jsonl` files without matching AWB run JSON should not be imported as runs automatically. They may be exposed later through a separate session browser, but durable AWB resume should require an AWB run record.

## Resume states and errors

Store or compute these resume states:

- `available`: the AWB run file is readable and `sessionFile` exists as a valid pi session file
- `not-started`: the run exists but no pi session file was created yet
- `missing-session-file`: `sessionFile` is set but the file no longer exists
- `invalid-session-file`: the pi file exists but cannot be opened as a pi session
- `cwd-mismatch`: the pi session header cwd does not match the run cwd/worktree path; this is a warning if AWB passes an explicit cwd override
- `worktree-missing`: the run requires a retained git worktree but the path is gone
- `worktree-cleaned`: the run used a git worktree that was intentionally cleaned; transcript remains inspectable, but follow-up prompts should be disabled unless AWB offers an explicit fork/back-to-project action

A degraded run should remain visible in the Agents tab with its transcript and tool activity. Follow-up prompts should be rejected with a specific message unless the state is `available`.

## Worktree interaction

The pi session should be reopened with the same cwd that was used when the run started:

- for shared-project runs: `projectDir`
- for retained worktree runs: `run.worktree.path`

If a retained worktree is missing or cleaned, AWB should not silently resume the pi conversation in the main project checkout. That would mix conversation context created for one filesystem state with a different working tree.

## pi SDK API

The required API is `SessionManager.open(path, sessionDir?, cwdOverride?)` from `@mariozechner/pi-coding-agent`.

For AWB resume, construct the agent session with:

```ts
sessionManager: SessionManager.open(run.sessionFile, awbSessionDir, cwd)
```

where `awbSessionDir` is `<projectDir>/.awb/pi-sessions` and `cwd` is either the shared project directory or the retained worktree path. The local SDK docs and types show `SessionManager.open(path, sessionDir?, cwdOverride?)` opens a specific session file, while the current AWB code uses `SessionManager.continueRecent(cwd, awbSessionDir)`, which can attach to the wrong run when multiple AWB runs exist.

