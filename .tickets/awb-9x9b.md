---
id: awb-9x9b
status: open
deps: [awb-vf2e, awb-s0fx]
links: []
created: 2026-05-11T08:51:52Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, runs, resume, backend, pi]
---
# Reopen a persisted pi session for follow-up prompts

Add true cross-restart resume: when a persisted AWB run has a valid pi session file, AWB should recreate an AgentSession bound to that conversation and allow follow-up prompts to continue it.

This depends on the durable storage design and persisted run metadata. It may require extending createPiSession to accept a specific session file/session id instead of always using continueRecent.

## Acceptance Criteria

- A persisted completed run with an existing pi session file can be resumed after AWB restart.
- Follow-up prompts append to the same AWB run transcript instead of creating a new run.
- Missing or incompatible pi session files produce a clear non-resumable state/message.
- The implementation does not accidentally attach a run to a different recent pi session.
- Tests or documented manual verification cover the specific-session reopen path.


## Notes

**2026-05-11T09:01:41Z**

Resume requirement applies to closed unticketed chats as well as completed ticket-backed runs. A closed chat has no live session because close disposes it, but if its persisted pi session file is valid then resuming should reopen that specific session and continue the same AWB conversation.
