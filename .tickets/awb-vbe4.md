---
id: awb-vbe4
status: closed
deps: []
links: []
created: 2026-04-17T12:46:49Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-439e
---
# Add Bun tests for derived ticket data and readiness

Add unit tests for src/core/deriveData.ts and isClosedStatus() covering closed status normalization, reverse dependency derivation, missing deps, ready-state computation, statuses, and summary stats.

## Acceptance Criteria

- isClosedStatus is covered by Bun tests
- deriveData tests cover blockedBy, unblocks, missingDeps, and ready
- tests cover closed/done/resolved status handling
- tests verify summary stats and status collection

