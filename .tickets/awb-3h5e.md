---
id: awb-3h5e
status: open
deps: []
links: [awb-3n5p]
created: 2026-05-11T08:51:21Z
type: epic
priority: 1
assignee: Jens Kouros
tags: [agent, runs, resume, persistence]
---
# Resume and persist agent conversations

Users should be able to keep an agent conversation going instead of treating a completed run as a dead transcript.

Scope:
- resume/continue completed in-memory agent runs
- persist enough run metadata to survive AWB server restarts
- reopen the correct pi session when possible
- make the Agents UI clearly distinguish continuable, running, failed, and archived conversations

This epic should be split so UI-only and backend-only pieces can be worked in parallel where possible.

## Acceptance Criteria

- A completed agent run can be continued with a follow-up prompt.
- Agent conversations remain discoverable after an AWB restart.
- A persisted conversation can be resumed against the correct pi session when the runtime supports it.
- Failed/aborted conversations remain safe and explicit rather than silently resuming.
- Tickets under this epic identify parallelizable work and dependencies.


## Notes

**2026-05-11T08:55:33Z**

New requirement: unticketed agent chats should behave like a normal command-line pi session. After the assistant answers, the chat should remain open/waiting for user input indefinitely until the user explicitly quits/archives it. Ticket-backed runs can still have completed-task semantics; unticketed chats need separate long-lived conversation lifecycle and UI copy.

**2026-05-11T08:59:05Z**

Lifecycle naming decision: unticketed chats enter `waiting` after an assistant response finishes. Users explicitly `close` a chat when they want to end it; this is distinct from stopping/aborting an active response.

**2026-05-11T09:01:41Z**

Decisions from lifecycle discussion:
1. Closed chats/runs should be resumable later, consistent with terminal coding-agent behavior. Closing ends/disposes the current live session but does not make the conversation permanently terminal.
2. `waiting` is only for unticketed chats for now; ticket-backed runs keep `completed` semantics.
3. If AWB shuts down while an unticketed chat is `waiting`, persist it as waiting but not live until the pi session is rehydrated.
4. Closing a chat should dispose/release the live pi session immediately.
5. Closing while running is allowed and should abort/stop the active response before closing.
6. No delete action in this epic; close keeps history.
