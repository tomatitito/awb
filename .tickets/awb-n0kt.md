---
id: awb-n0kt
status: closed
deps: []
links: []
created: 2026-04-17T12:46:49Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-439e
---
# Add Bun tests for dependency graph derivation

Add unit tests for src/core/graph.ts covering cycle detection, layer derivation, deterministic ordering, transitive edge reduction, critical path computation, tie-breaking, and visible graph filtering for selected-ticket related links.

## Acceptance Criteria

- deriveGraph is covered by Bun tests
- tests cover cycle detection and cycle output
- tests cover layered layout and deterministic sibling ordering
- tests cover reduced dependency edges and critical path behavior
- tests cover deriveVisibleGraph related-edge filtering and critical-path visibility trimming

