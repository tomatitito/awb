---
id: awb-b7ve
status: open
deps: [awb-hjm7, awb-m2d6]
links: []
created: 2026-04-17T20:55:53Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-6iak
tags: [ui, responsive, layout, mobile, graph, details, agent]
---
# Polish mobile Graph, Details, and Agent workflows

Refine the phone-sized AWB experience for Graph, Details, and Agent after the responsive layout architecture is in place. Graph should work as a focused single-view mobile workspace without a persistent sidebar, Details should be fully readable as its own destination, and Agent should be accessible without using the desktop side-panel composition.

This ticket covers mobile interaction polish rather than the initial architecture split.

## Acceptance Criteria

- on phone-sized screens, Graph is usable without a persistent ticket sidebar
- mobile Graph uses top-to-bottom as the default direction unless the user has explicitly chosen another direction
- selecting and inspecting tickets from Graph/Details is clear and does not depend on desktop pane composition
- Details is fully readable and navigable as a dedicated mobile view
- Agent is presented as a mobile-appropriate overlay, sheet, or dedicated view rather than a persistent side rail
- bun run build succeeds

