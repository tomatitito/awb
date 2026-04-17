---
id: tv-u8v3
status: closed
deps: [tv-y581, tv-pqg2]
links: [tv-eq0d, tv-pqg2, tv-y581]
created: 2026-04-13T09:13:59Z
type: task
priority: 2
parent: tv-1mg4
tags: [implementation-plan]
---
# Derive ready state, reverse deps, and missing deps

Compute blockedBy, unblocks, missingDeps, isClosed, and ready using the project's closed-status heuristics.

## Acceptance Criteria

- Derived tickets include blockedBy, unblocks, missingDeps, ready, and isClosed fields.
- Closed status detection uses the documented heuristic for closed, done, and resolved.
- Ready tickets are only marked ready when they are open and all existing deps are closed with no missing deps.
