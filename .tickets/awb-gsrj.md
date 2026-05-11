---
id: awb-gsrj
status: open
deps: [awb-34le, awb-b7cs, awb-9x9b, awb-uhql, awb-5jki, awb-ecc1]
links: []
created: 2026-05-11T08:51:52Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, runs, resume, tests, docs]
---
# Document and regression-test agent conversation resume

Add coverage and docs for the resume workflow once backend and UI pieces land. Include both in-memory continuation and durable cross-restart behavior.

## Acceptance Criteria

- README or wiki documentation explains how agent conversation resume works and its limitations.
- Tests cover in-memory continuation, persisted history loading, and non-resumable error states.
- Any mobile regression hooks/selectors needed for resume controls are documented.
- bun run check passes.

