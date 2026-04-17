# Graph derivation rules

These rules define the dependency-first Graph mode semantics used by `awb`.

## Source graph

- The dependency graph is built from all tickets and their `deps` references.
- Only existing ticket-to-ticket dependencies participate in layering and critical-path computation.
- Non-dependency `links` are excluded from dependency ordering.

## Layering

- Graph mode uses deterministic topological layering.
- A ticket's layer is the longest dependency distance from any root ticket.
- Root tickets with no incoming dependencies are placed in layer `0`.
- Tickets inside the same layer are ordered deterministically by ticket id.
- If a dependency cycle exists, layering is not rendered.

## Displayed dependency edges

- The rendered dependency graph uses transitive reduction semantics.
- A dependency edge is hidden when another dependency path already preserves the same reachability.
- Hiding redundant edges never changes dependency reachability in the underlying graph.
- Critical-path computation still uses the full dependency graph, not only the reduced edge set.

## Critical path

- The critical path is the longest path in the full dependency graph by edge count.
- Tie-breaking is deterministic by ticket id traversal order.
- UI highlighting is optional and can be toggled off.
- Filtering or hiding closed tickets does not recompute the critical path; the UI only shows the visible subset of the already-derived path.

## Cycles

- Dependency cycles are treated as a non-success graph state.
- When a cycle is detected, Graph mode shows a cycle warning and does not render a misleading layered order.

## Filtering and hidden tickets

- `hide closed` and sidebar filters determine which tickets are rendered.
- Dependency layers are still derived from the full graph before filtering.
- Filtered graph rendering keeps the original derived layer positions for visible tickets.
- Rendered dependency edges are shown only when both endpoints are visible.
- Critical-path highlighting is clipped to visible nodes and edges.

## Related links

- Non-dependency `links` never influence dependency layers, reduced dependency edges, or critical-path computation.
- Related links are revealed only for the currently selected ticket.
- Related-link reveal is purely contextual and visually distinct from dependency edges.
- If a selected ticket also has a direct dependency relationship with a linked ticket, Graph mode suppresses the related-link overlay for that pair to avoid duplicating dependency semantics.

## Presentation defaults

- Graph mode defaults to a left-to-right layout.
- The graph toolbar exposes a clear two-state layout control: `Left → right` and `Top → bottom`.
- Critical-path highlighting defaults to on and is controlled by a dedicated toolbar toggle.
- Graph cards use a compact format with ticket id, title, status, and epic context.
- Card titles are truncated to two lines.
- Child tickets show epic context as `Epic <id>`.
- Epic tickets show an explicit `Epic` indicator instead of a parent reference.
- Selecting a ticket reveals its non-dependency related links and subtly emphasizes the related target tickets.
