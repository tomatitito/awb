---
id: tv-ej2e
status: open
deps: []
links: []
created: 2026-04-13T18:12:51Z
type: task
priority: 2
assignee: Jens Kouros
parent: tv-et04
tags: [accessibility, graph, review]
---
# Improve accessibility of graph and tab navigation

The graph interaction is pointer-first and the hover card is mouse-oriented. The tab strip uses styled buttons without tab semantics. The sidebar gives a partial keyboard path, but the relationship view needs a more complete keyboard and assistive-tech model.

## Acceptance Criteria

Tabs expose appropriate roles/states or another accessible navigation pattern. The selected ticket and relationship context are reachable without pointer interaction. Graph hover details have a keyboard-accessible equivalent. Focus states and screen reader labels are verified for primary controls.

