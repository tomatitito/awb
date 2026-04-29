---
id: awb-t5q1
status: closed
deps: []
links: [tv-nvfy]
created: 2026-04-29T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-c9p4
tags: [code-quality, biome, css, styling]
---
# Fix descending-specificity diagnostics in `src/web/styles.css`

Resolve the remaining Biome CSS diagnostics caused by mobile-specific selectors appearing before their less-specific base selectors.

## Current problem selectors

- `.viewport-mobile .details-view` appears before `.details-view`
- `.viewport-mobile .details-header` appears before `.details-header`
- `.viewport-mobile .meta-grid` appears before `.meta-grid`

## Required fixes

- reorder or restructure the relevant CSS so base selectors are defined before more-specific mobile overrides
- preserve the current mobile layout behavior for details view spacing, details header layout, and metadata grid columns
- avoid introducing duplicate/conflicting rules if a simple reorder is sufficient
- keep the stylesheet readable and consistent with nearby responsive rules

## Acceptance Criteria

- `src/web/styles.css` no longer produces descending-specificity diagnostics
- mobile and desktop Details layouts remain visually unchanged or intentionally improved
- `bun run check` moves closer to green with this ticket alone

## Notes

**2026-04-29T13:30:00Z**

Reordered the Details base selectors so `.details-view`, `.details-header`, and `.meta-grid` are defined before their `.viewport-mobile` overrides. This preserves the existing mobile layout behavior while eliminating the remaining descending-specificity diagnostics in `src/web/styles.css`. Verified with `bunx biome check src/web/styles.css` and `bun run check --max-diagnostics=50`.
