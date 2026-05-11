---
id: awb-uhql
status: open
deps: [awb-s0fx, awb-9x9b, awb-5jki]
links: []
created: 2026-05-11T08:51:52Z
type: feature
priority: 2
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, runs, resume, ui, persistence]
---
# Show persisted conversation resume states in the Agents UI

Update the Agents UI for persisted conversations that may or may not have a live/resumable pi session. The UI should make the state obvious and guide the user to continue, inspect read-only history, or start a new chat from context.

## Acceptance Criteria

- Persisted conversations appear in the Agents list with restored title/status/timestamps.
- Resumable conversations show a Resume/Continue affordance.
- Non-resumable persisted conversations are read-only and explain why.
- The UI does not present stale interrupted runs as actively running.
- The feature works in desktop and mobile Agents layouts.


## Notes

**2026-05-11T09:01:41Z**

Persisted UI states must represent closed-but-resumable chats separately from non-resumable error states. A closed chat should offer resume when its persisted pi session can be reopened.
