---
id: tv-2rwr
status: open
deps: []
links: []
created: 2026-04-13T18:12:42Z
type: task
priority: 2
assignee: Jens Kouros
parent: tv-et04
tags: [graph, performance, review]
---
# Avoid unnecessary graph recomputation on selection and search changes

The current GraphView is no longer Cytoscape-based, but the underlying performance concern remains: selecting a ticket or updating search should not trigger unnecessary layout recomputation, expensive redraw work, or interaction-state resets that make the graph feel unstable on larger ticket sets.

## Acceptance Criteria

- Selection changes update only the visual selected state needed by the graph.
- Search changes update match/dim styling without recomputing graph structure or layout unless the visible topology actually changes.
- Graph interaction state remains stable during ordinary selection and search updates.
- Any remaining expensive graph recomputation is limited to true topology/input changes and is validated manually or with a focused regression check on a larger fixture.

