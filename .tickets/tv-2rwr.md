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
# Stop rebuilding the Cytoscape graph on selection and search changes

GraphView creates and destroys the Cytoscape instance whenever tickets, selectedId, search, or onSelect changes. Clicking a node or typing search reruns layout and resets interaction state, which will become expensive on larger ticket sets.

## Acceptance Criteria

Cytoscape instance lifetime is decoupled from selection and search styling. Selection changes update the existing graph without rerunning layout. Search changes update node/edge classes without destroying the graph. Topology changes still refresh graph elements correctly. Behavior is tested manually or with a focused regression check on a larger fixture.

