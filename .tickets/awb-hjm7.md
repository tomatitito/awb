---
id: awb-hjm7
status: open
deps: []
links: []
created: 2026-04-17T13:42:39Z
type: feature
priority: 2
assignee: Jens Kouros
parent: awb-6iak
tags: [ui, responsive, layout, mobile]
---
# Introduce viewport-aware layout architecture for AWB

Implement the responsive layout foundation for AWB so the app can render different compositions for mobile, tablet/small laptop, and desktop instead of compressing the desktop multi-pane layout onto narrow screens.

This ticket focuses on the architecture and first-pass layout switching, not the final mobile Kanban carousel or the final mobile Graph/Agent polish. It should establish the code structure and initial behavior needed for follow-up responsive tickets.

## Scope

- add a viewport mode abstraction for `mobile`, `tablet`, and `desktop`
- keep shared data loading and workspace state in `App`
- compute Graph direction from a user preference plus viewport-specific defaults
- use `top-to-bottom` as the default Graph direction on mobile and `left-to-right` elsewhere
- split rendering into layout components such as `ResponsiveWorkspaceLayout`, `DesktopWorkspaceLayout`, `TabletWorkspaceLayout`, and `MobileWorkspaceLayout`
- extract reusable shared UI sections such as the top bar, tabs/stats header, and graph panel so they can be reused across layout modes
- preserve the current desktop multi-pane workflow as the desktop composition
- introduce a mobile composition that shows only one primary workspace view at a time: Kanban, Graph, or Details
- render the agent experience as a non-persistent mobile/tablet overlay or sheet instead of a desktop side rail

## Out of Scope

- final mobile Kanban one-column swipe interaction
- final mobile Graph interaction polish beyond the default direction and single-view composition
- final mobile navigation/content IA polish beyond the initial layout split

## Implementation Notes

- prefer React conditional rendering for composition changes and CSS media queries for styling adjustments
- avoid rendering the desktop pane composition on phone widths and hiding pieces with CSS alone
- keep existing shared business state for selected ticket, active tab/view, filters, search, hide-closed, graph controls, and agent state
- treat viewport-specific Graph direction as an effective default so a user-selected direction can still override it

## Acceptance Criteria

- `App` keeps shared data loading, filtering, selection, and agent state while delegating viewport-specific rendering to dedicated layout components
- a viewport mode abstraction exists with at least `mobile`, `tablet`, and `desktop`
- desktop layout preserves the current multi-pane experience for Graph, Details, and optional agent panel
- tablet layout reduces simultaneous panes relative to desktop and avoids the compressed desktop composition
- mobile layout renders a single primary workspace view at a time instead of the desktop pane composition
- mobile layout provides clear switching between Kanban, Graph, and Details
- mobile/tablet agent UI no longer depends on a persistent side panel composition
- the default Graph direction is `top-to-bottom` on mobile and `left-to-right` on non-mobile widths unless the user explicitly changes it
- reusable layout pieces for header/navigation/graph panel are extracted or clearly separated in code
- unintended horizontal overflow from the desktop composition is removed for mobile/tablet layouts
- `bun run build` succeeds

