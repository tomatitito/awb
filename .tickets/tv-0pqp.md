---
id: tv-0pqp
status: open
deps: []
links: []
created: 2026-04-13T18:12:55Z
type: bug
priority: 2
assignee: Jens Kouros
parent: tv-et04
tags: [ux, dependencies, review]
---
# Render missing dependency IDs as unresolved references

DetailsView passes missingDeps to the same RelatedList component used for real ticket links. Clicking a missing dependency sets selectedId to a nonexistent ticket, leaving the Details pane empty rather than explaining that the referenced ticket is missing.

## Acceptance Criteria

Missing deps are visually distinct from existing ticket links. Clicking or focusing a missing dep does not silently select a nonexistent ticket. Users can see which dependency IDs are unresolved. Existing depends-on, related, and unblocks links keep their current behavior.

