---
id: awb-b7cs
status: closed
deps: []
links: [awb-34le, awb-5jki]
created: 2026-05-11T08:51:52Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, runs, resume, ui]
---
# Expose continue controls for completed agent runs

Update the Agents view so users can continue a completed conversation from its detail panel instead of seeing it as permanently read-only.

This is intentionally UI-focused and can be developed in parallel with backend lifecycle hardening because the per-run prompt endpoint already exists. Use defensive copy/error handling if the backend rejects a stale run.

## Acceptance Criteria

- Completed runs show a follow-up composer labelled as continuing/resuming the conversation.
- Running/starting runs keep their current send/stop behavior.
- Failed and aborted runs remain read-only with clear explanatory copy.
- The composer handles backend rejection by showing the returned error.
- Mobile Agents view has the same continue affordance as desktop.

