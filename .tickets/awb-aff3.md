---
id: awb-aff3
status: closed
deps: [awb-b7ve]
links: []
created: 2026-04-17T22:06:24Z
type: task
priority: 3
assignee: Jens Kouros
parent: awb-6iak
tags: [ui, responsive, testing, mobile, maestro]
---
# Add Maestro mobile regression coverage for Graph, Details, and Agent flows

Add programmatic mobile regression coverage for the AWB mobile Graph, Details, and Agent flows using Maestro, if feasible within the current app/test harness. Focus on the key mobile behaviors defined in awb-b7ve so that responsive interaction regressions can be caught automatically.

## Acceptance Criteria

- a Maestro flow (or equivalent automated mobile flow) covers Graph → Details selection on AWB mobile mode (`max-width: 767px`)
- automated coverage verifies that returning from Details to Graph preserves the selected ticket
- automated coverage verifies that Agent opens from the mobile header control and closes back to the previously active view
- where the UI exposes stable state, automated coverage verifies that closing the Agent overlay does not implicitly stop an in-progress run
- any required test fixtures, stable selectors, or mock agent states are documented or added as part of the implementation
- bun run build succeeds

## Notes

**2026-04-17T22:40:00Z**

Implemented equivalent automated mobile regression coverage with Bun flow tests in `tests/web/mobileFlow.test.ts` because the current repo does not yet include a runnable Maestro device harness. Added stable `data-awb` selectors for Graph, Details, and Agent mobile interactions, extracted shared mobile flow helpers in `src/web/mobileFlow.ts`, and wired the mobile layout to those helpers. Verified: `bun test` passes and `bun run build` succeeds.

