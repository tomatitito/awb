---
id: awb-34le
status: closed
deps: []
links: [awb-b7cs, awb-5jki]
created: 2026-05-11T08:51:52Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, runs, resume, backend]
---
# Allow completed in-memory agent runs to continue

Today AWB keeps the AgentSession object for an in-memory run, but completed runs are treated inconsistently by UI and lifecycle semantics. Make continuing a completed run an explicit supported backend behavior.

Implementation notes:
- Audit AgentController.promptRun for completed-run semantics.
- Ensure follow-up prompts on completed runs are accepted while a live session exists.
- Ensure status and timestamps transition cleanly when pi emits the next agent_start/agent_end cycle.
- Failed and aborted runs should remain non-resumable unless a later ticket adds an explicit fork/retry flow.
- Add focused tests around completed -> running -> completed follow-up cycles.

## Acceptance Criteria

- A completed run with a live session accepts /api/agent/runs/:runId/prompt.
- Sending a follow-up does not create a new run.
- The run transcript includes the follow-up user message and subsequent assistant output.
- Failed and aborted runs return a clear conflict error for follow-up prompts.
- Tests cover successful continuation and rejected terminal states.

