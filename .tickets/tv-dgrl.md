---
id: tv-dgrl
status: closed
deps: [tv-rlnk]
links: [tv-gd42, tv-layr, tv-cdsg]
created: 2026-04-14T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
parent: tv-gd42
tags: [graph, algorithm, design]
---
# Define graph derivation rules for the layered dependency view

Write down the graph-processing rules behind the redesigned Graph mode so implementation does not need to make product or algorithm decisions ad hoc. This ticket owns the data and algorithm semantics behind dependency layers, displayed edges, critical path, cycle handling, filtering, and selected-ticket related-link derivation.

## Acceptance Criteria

- Dependency layers are derived from the full dependency graph using a deterministic topological layering approach.
- Displayed dependency edges remove redundant transitive edges without changing reachability.
- Critical path is computed from the full dependency graph as the longest path by edge count, independent of whether transitive edges are hidden in the UI.
- Cycles in dependency data are detected and surfaced with a clear non-success graph state instead of silently rendering misleading ordering.
- The behavior of filtering and hide-closed settings is defined for layered layout, critical path highlighting, and selected-ticket related-link reveal.
- Selected-ticket non-dependency related links are derived separately from dependency ordering and do not alter dependency layers or critical-path computation.
