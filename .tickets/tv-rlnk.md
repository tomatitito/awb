---
id: tv-rlnk
status: open
deps: []
links: [tv-gd42, tv-y2q8]
created: 2026-04-14T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
parent: tv-gd42
tags: [ui, graph, design]
---
# Decide how graph mode should handle related links without dependencies

The current data model distinguishes hard dependencies (`deps`) from looser relationships (`links`). In a dependency-first graph layout, those looser relationships can add noise or suggest ordering that does not actually exist.

## Decision

- By default, Graph mode shows dependency edges only.
- Non-dependency related links are revealed only for the currently selected ticket.
- Related links must be visually distinct enough that they cannot be mistaken for dependency ordering.

## Acceptance Criteria

- Default Graph mode emphasizes implementation ordering by showing dependency structure without unrelated edge noise.
- Selecting a ticket can reveal its non-dependency related links without implying execution order.
- Users can distinguish required ordering from loose association.
- The chosen behavior fits the new layered layout and does not undermine readability.
