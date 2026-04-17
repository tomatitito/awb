---
id: awb-b7ve
status: closed
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

For this ticket, "phone-sized screens" means AWB's existing mobile viewport mode: viewport widths below 768px (`max-width: 767px`). Tablet behavior (`768px–1199px`) and desktop behavior (`>= 1200px`) are out of scope unless explicitly called out.

Note: if distinct pause/stop Agent controls require backend or agent-runtime changes that are not already available, this ticket should keep the mobile UI from implicitly stopping an in-progress run when the overlay or pane is closed, and the separate pause/stop capability can be deferred to a follow-up ticket.

## Acceptance Criteria

- on phone-sized screens (AWB mobile mode, `max-width: 767px`), Graph is usable without a persistent ticket sidebar
- on mobile (`max-width: 767px`), Graph defaults to top-to-bottom (`tb`) when no graph direction preference has been explicitly chosen by the user
- an explicit user-selected graph direction overrides the mobile default
- the chosen graph direction remains in effect while navigating between Graph, Details, and Kanban during the current session
- changing between mobile and tablet/desktop viewport modes does not clear an explicit graph direction preference during the current session
- on AWB mobile mode (`max-width: 767px`), tapping a node in Graph sets that ticket as the selected ticket, switches the active view to `Details`, and renders the selected ticket in the dedicated mobile Details view
- returning from Details to Graph uses the existing mobile tab navigation while preserving the current selected ticket
- mobile ticket inspection does not rely on desktop side-by-side panes
- Details renders the full ticket body, metadata, and linked ticket navigation in a dedicated mobile view without relying on a concurrent sidebar or secondary pane
- on mobile (`max-width: 767px`), Agent opens as a full-screen overlay instead of a persistent side rail
- the mobile Agent overlay is opened from the existing Agent control in the mobile header
- closing the Agent overlay returns the user to their previously active view (`Graph`, `Kanban`, or `Details`)
- closing the Agent overlay or desktop Agent pane does not stop an in-progress Agent run; stopping or pausing Agent work requires an explicit control in the Agent UI
- Agent provides explicit mobile-usable controls to stop and pause execution independently
- the selected ticket context remains available to Agent when the overlay is opened and closed
- Agent transcript, prompt input, and tool activity are fully usable within the mobile overlay
- bun run build succeeds

## Implementation Notes

- likely touchpoints include `src/web/App.tsx`, `src/web/layouts.tsx`, `src/web/workspace.tsx`, `src/web/useViewportMode.ts`, `src/web/styles.css`, and related Agent UI components
- this ticket is expected to refine the existing responsive/tabbed architecture rather than introduce a new routing system

## Verification

- bun run build succeeds
- manually verify behavior in AWB mobile mode (`max-width: 767px`)
- verify that tapping a Graph node on mobile selects the ticket and opens the dedicated Details view
- verify that returning from Details to Graph preserves the selected ticket
- verify that Agent opens as a full-screen overlay and closes back to the previously active view
- verify that closing the Agent overlay or pane does not implicitly stop an in-progress run
- verify that Graph defaults to top-to-bottom on mobile unless the user has explicitly selected another direction
- if Maestro-based UI verification is already available or easy to add, include a mobile regression flow for the Graph → Details transition and Agent overlay behavior; otherwise, track automated mobile regression coverage in a follow-up ticket

