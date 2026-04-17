---
id: awb-wvyh
status: closed
deps: []
links: []
created: 2026-04-17T13:19:27Z
type: feature
priority: 2
assignee: Jens Kouros
tags: [ui, layout, header]
---
# Merge stats row into tabs header

Collapse the top-level stats row and tabs row into a single header row. Keep the tabs aligned on the left and move the stats summary to the right side of the same row.

## Acceptance Criteria

- the separate .stats-row no longer renders above the tabs\n- tabs and stats render in a single horizontal row\n- stats are aligned to the right side of the combined row\n- layout remains usable on narrower widths\n- bun run build succeeds

