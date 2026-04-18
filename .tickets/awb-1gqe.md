---
id: awb-1gqe
status: open
deps: []
links: [awb-kg0z, awb-vxxn, awb-hjm7, awb-b7ve]
created: 2026-04-18T00:00:00Z
type: feature
priority: 2
assignee: Jens Kouros
tags: [agent, panel, ui, desktop, pi, terminal, layout]
---
# Redesign the desktop agent panel to match pi's terminal-style interface

The current desktop agent panel works functionally, but it still feels like a narrow right sidebar made from separate web cards rather than a true pi-like agent workspace. At the moment the panel is fixed at a small width and the transcript, tool output, and prompt composer do not resemble the terminal experience closely enough.

AWB should redesign the desktop agent panel so it feels much closer to using pi in the terminal while still fitting naturally into the existing desktop workbench. This includes a significantly wider default panel, a configurable desktop width, and a denser transcript-first presentation that reduces the card-heavy dashboard feel.

This ticket is intentionally focused on the desktop panel UX and visual system. It should not regress the responsive/mobile agent overlay work.

## Scope

- increase the default desktop agent panel width substantially relative to the current fixed side rail
- make desktop panel width configurable, ideally with a direct resize affordance and persisted preference
- restyle the desktop panel so it is clearly inspired by pi's terminal UI rather than a generic web settings/sidebar panel
- make the transcript the dominant surface in the panel
- compress model/session/status/context metadata into a tighter header or status area
- render tool activity in a way that feels closer to terminal run logs than independent dashboard tiles
- make the prompt composer feel closer to a terminal input surface

## Out of Scope

- changing the underlying server-side pi session architecture
- replacing the mobile/tablet overlay model with a persistent side rail
- implementing full session tree navigation, `/new`, `/resume`, or other terminal commands not already supported by the current embedded panel flow

## Acceptance Criteria

- on desktop, the agent panel uses a significantly wider default width than the current implementation
- desktop users can configure the panel width; at minimum there is a visible width preference or resize affordance
- if a resize affordance is implemented, the chosen desktop width persists across reloads for the same browser
- the desktop panel visual design is updated to align more closely with pi's terminal interface, using a denser text-first presentation
- transcript readability is improved for long assistant responses and tool output, and the transcript is the primary visual focus of the panel
- model, session, status, and selected-ticket context are presented in a more compact header or status area rather than as dominant stacked cards
- tool activity rendering feels consistent with the terminal-inspired panel design
- the existing desktop Graph, Kanban, and Details workflows remain usable with the panel open
- mobile and tablet agent behavior is not regressed; if the desktop redesign intentionally introduces styling differences from mobile/tablet, those differences are kept localized to the desktop composition
- existing stable `data-awb` selectors used by agent controls remain available unless a selector migration is explicitly documented and updated everywhere it is consumed
- `bun run build` succeeds

## Implementation Notes

- likely touchpoints include `src/web/AgentPanel.tsx`, `src/web/styles.css`, `src/web/layouts.tsx`, and related agent UI helpers
- the current fixed desktop width in the main content grid should be replaced by a desktop width variable or stateful layout value
- prefer a transcript-first composition over multiple equally prominent boxed sections
- keep the result web-native, but use pi terminal conventions where they improve information density and readability
- if needed, split the work into a structural React update plus a styling pass, but keep both under this ticket unless a follow-up becomes necessary

## Verification

- run `bun run build`
- manually verify the desktop agent panel at common laptop/desktop widths
- verify the panel can be widened and, if supported, resized/configured without breaking adjacent workspace content
- verify long transcript entries and tool activity remain readable
- verify mobile/tablet agent overlay behavior still works as before
