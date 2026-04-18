---
id: tv-gd42
status: closed
deps: []
links: [tv-y2q8, tv-x8xs]
created: 2026-04-14T00:00:00Z
type: epic
priority: 2
assignee: Jens Kouros
tags: [ui, graph, planning]
---
# Redesign graph mode around dependency planning

Rework Graph mode so it is easier to understand implementation order, direct dependencies, and tickets that can be worked on in parallel. Replace the current generic node-link visualization with a dependency-first layout that uses ticket cards instead of circles.

## Acceptance Criteria

- Follow-up work is split into actionable child tickets.
- The redesign targets ordering clarity first, not additional metadata cues.
- Open product questions, especially around non-dependency related links, are resolved before implementation is finalized.
