---
id: awb-m2d6
status: closed
deps: [awb-hjm7]
links: []
created: 2026-04-17T20:55:42Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-6iak
tags: [ui, responsive, layout, mobile, navigation]
---
# [awb-m2d6] Implement mobile navigation and compact mobile header for AWB

Implement the phone-first navigation shell for AWB after the viewport-aware layout architecture is in place. Add a mobile-specific header/navigation pattern that makes switching between the primary mobile views explicit and keeps secondary controls accessible without reusing the desktop toolbar unchanged.

This ticket should cover the mobile top bar, primary view switcher, and placement of search/filter/agent actions suitable for phone usage.

## Acceptance Criteria

- a mobile-specific header or navigation shell exists instead of reusing the desktop top bar unchanged
- phone users can clearly switch between Kanban, Graph, and Details
- agent access is available from the mobile navigation/header
- search and hide-closed remain accessible on phone-sized screens
- mobile navigation/header does not introduce broken wrapping or unusable tap targets
- bun run build succeeds

