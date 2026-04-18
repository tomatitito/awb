---
id: tv-layr
status: closed
deps: [tv-rlnk, tv-dgrl]
links: [tv-gd42, tv-y2q8, tv-x8xs]
created: 2026-04-14T00:00:00Z
type: feature
priority: 2
assignee: Jens Kouros
parent: tv-gd42
tags: [ui, graph, planning]
---
# Implement layered dependency graph with ticket cards and optional critical path

Replace the current graph visualization with a layered DAG-style dependency view that makes implementation order easier to read. Render tickets as compact cards, support both left-to-right and top-to-bottom directions, and allow users to toggle critical path highlighting on or off. Follow the agreed graph derivation rules and the approved card/control presentation defaults.

## Acceptance Criteria

- Graph mode renders tickets as compact cards instead of circles.
- Each card shows the ticket id, title, status, and epic context.
- The layout communicates ordering through dependency layers and makes parallelizable tickets visible by placement rather than extra cues.
- Users can switch the layout direction between left-to-right and top-to-bottom.
- Users can toggle critical path highlighting on and off.
- Critical path is computed as the longest dependency chain by edge count.
- The rendered dependency edges favor direct dependencies over redundant transitive edges.
- The final implementation follows the product decision for non-dependency related links and the defined graph derivation rules.
