---
id: tv-x8xs
status: closed
deps: [tv-y2q8, tv-qxzv]
links: [tv-y2q8]
created: 2026-04-13T09:34:04Z
type: feature
priority: 2
parent: tv-mpq8
tags: [ui, graph, codex-parity]
---
# Improve graph interactions with search highlighting and hover summaries

Improve graph usability with two related interaction upgrades: search should visibly emphasize matching nodes, and hovering a node should show a concise summary with a direct path into the Details view.

## Acceptance Criteria

- Entering a search term leaves the graph usable while visibly emphasizing matching tickets.
- Match emphasis is distinct from selected-node styling and works with the existing hide-closed and shared search behavior.
- Hovering a graph node shows a popup with a short summary of the ticket.
- The popup is clickable and switches the app to the Details view for that ticket.
- The combined interaction behavior is stable enough to use without interfering with node selection in the graph.

