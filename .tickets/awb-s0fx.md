---
id: awb-s0fx
status: open
deps: [awb-vf2e]
links: []
created: 2026-05-11T08:51:52Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, runs, persistence, backend]
---
# Persist agent run metadata and transcripts on disk

Persist AWB AgentRunState records so the Agents view can list prior conversations after an AWB restart. This ticket is about durable listing/history, not necessarily making the pi session live again.

Implementation notes:
- Store run context, status, timestamps, transcript entries, tool activity, model, session id/file, errors, queue counters, and worktree state.
- Write updates whenever AgentController mutates or emits a run update.
- Load persisted runs during project runtime initialization.
- Mark previously running/starting/queued runs as an explicit stale/non-live state or failed/aborted equivalent according to the design ticket.
- Keep storage project-scoped under .awb/.

## Acceptance Criteria

- Agent runs remain listed after restarting AWB in the same project.
- Transcripts and tool activity are restored for read-only inspection.
- Interrupted active runs are not displayed as still running.
- Corrupt persistence data does not prevent AWB from starting; a warning/error state is surfaced.
- Backend tests cover save/load and interrupted-run normalization.


## Notes

**2026-05-11T09:01:41Z**

Persistence requirement: store enough state to distinguish live `waiting` chats, closed-but-resumable chats, and interrupted waiting chats after AWB shutdown. On restart, waiting chats may be listed as waiting/not-live until the specific pi session is rehydrated.
