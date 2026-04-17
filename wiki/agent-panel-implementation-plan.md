# AWB agent panel implementation plan

## Goal

See also: [AWB pi SDK agent panel design](./pi-sdk-agent-panel-design.md)

Add a toggleable agent panel to `awb` that opens on the right side of the existing application UI and uses the pi SDK as the preferred integration path.

Related tickets:

- `awb-7vzs` — epic: Build the awb agent panel
- `awb-kg0z` — Add agent panel layout and toggle controls
- `awb-vxxn` — Integrate the pi SDK into the agent panel
- `awb-vqm7` — Document agent panel architecture and follow-up workflow work

## Decision summary

### Primary approach

Use an **in-app React panel** inside `awb`.

This matches the current architecture:

- `awb` is already a browser-based React UI
- the user wants a panel that opens on the right
- the existing app already uses split layouts for Graph and Details

### pi integration direction

Use the **pi SDK** for agent runtime and session integration.

The first milestone should focus on:

- panel layout
- panel visibility state
- a minimal panel shell
- a narrow pi integration seam

It should **not** try to solve full workflow orchestration on day one.

### Glimpse

[Glimpse](https://github.com/hazat/glimpse) is worth keeping in mind, but **not as the main implementation for the first `awb` panel**.

Reason:

- Glimpse opens a separate native micro-UI window
- `awb` needs an embedded right-side panel inside the current web app
- using Glimpse as the primary panel would create a second UI surface instead of extending the current one

Good future uses for Glimpse:

- floating agent status pill
- always-on-top companion window
- quick prompt/confirmation UI
- menu bar helper on macOS

So the plan is:

- **embedded panel in `awb` now**
- **optional Glimpse companion later**

## Current app structure

Relevant current files:

- `src/web/App.tsx` — top-level app layout and tab rendering
- `src/web/styles.css` — layout and visual styling
- `src/server.ts` — local server
- `src/cli.ts` — CLI entrypoint

Relevant current UI behavior:

- Graph view uses a 3-column split layout
- Details view uses a 2-column split layout
- top bar and tabs are already established
- there is no agent state or agent panel yet

## MVP scope

The first useful version should include:

1. a toolbar button to toggle the agent panel
2. a right-side panel container that opens and closes cleanly
3. minimal panel content, such as:
   - panel title
   - placeholder/status area
   - selected ticket context summary
   - pi integration status or session placeholder
4. no breakage to existing Graph, Kanban, or Details flows

Out of scope for MVP:

- full Ralph-style ticket execution loop
- autonomous multi-ticket planning
- background worker orchestration
- external overlay/companion UI
- complex persistence or resumable runs unless pi requires it immediately

## Proposed architecture

## 1. UI shell and layout

Add a top-level boolean state in `App.tsx`, e.g.:

- `isAgentPanelOpen`

Add a toggle control in the top toolbar, for example:

- `Open agent`
- `Hide agent`

Then introduce a reusable right-side panel wrapper that can be composed into each tab layout.

### Suggested components

- `AgentPanel`
- `AgentPanelToggle`
- optional `AgentPanelShell`

A simple first step is to keep these in `src/web/` until the UI grows enough to justify a subdirectory.

## 2. Layout strategy

The least risky strategy is:

- preserve the existing left and center content
- append the agent panel as the outermost right column
- let Graph mode temporarily have four regions when both Details and Agent are open:
  - sidebar
  - graph
  - details
  - agent panel

Alternative if space gets too tight:

- hide the Details pane when the agent panel is open in Graph mode
- keep Details accessible through the Details tab

Recommended implementation order:

1. first make the agent panel coexist with the current layouts
2. test usability
3. only collapse/swap panes if the 4-column layout is too cramped

## 3. Minimal data passed into the panel

The panel should receive only a small, stable set of props at first:

- `selectedTicket`
- `projectDir`
- `ticketsDir` or equivalent project context if needed
- `isOpen`
- callbacks for close/toggle

Avoid coupling the panel directly to all existing app state.

## 4. pi integration seam

Create a dedicated integration boundary for pi rather than mixing SDK calls directly into layout code.

Suggested shape:

- `src/web/pi/` or `src/pi/`
  - `client.ts`
  - `types.ts`
  - `mock.ts` or `adapter.ts`

Even if the first version is thin, the point is to isolate:

- SDK initialization
- session lifecycle
- any event subscriptions
- mapping pi events into UI state

The React panel should talk to a small internal adapter, not to raw SDK calls spread through the component tree.

## 5. MVP panel states

Define explicit UI states early:

- `closed`
- `idle`
- `connecting`
- `ready`
- `error`

Optional later:

- `running`
- `waiting-for-input`
- `complete`

A clear state model will make the first SDK integration easier and keep the UI predictable.

## Implementation phases

## Phase 1 — `awb-kg0z`: layout and toggle controls

Deliverables:

- add toolbar toggle button
- add `isAgentPanelOpen` state
- add right-side panel shell
- ensure Graph, Kanban, and Details render correctly with panel open and closed
- style panel for current app theme

Concrete steps:

1. Add toggle button near the existing search and `hide closed` controls.
2. Add a right-side `<aside>` or panel section in each tab layout.
3. Create minimal placeholder content:
   - heading: `Agent`
   - selected ticket id/title, if any
   - placeholder text such as `pi integration not connected yet`
4. Add responsive CSS behavior for narrower viewports.
5. Verify that panel open/close does not break scrolling or sticky sidebar behavior.

Acceptance notes:

- prioritize layout safety over sophistication
- avoid introducing modal behavior
- preserve existing ticket selection behavior

## Phase 2 — `awb-vxxn`: pi SDK integration

The concrete SDK design now lives in [`wiki/pi-sdk-agent-panel-design.md`](./pi-sdk-agent-panel-design.md).


Deliverables:

- add pi SDK dependency if needed
- create a thin adapter around pi
- surface connection/session status in the agent panel
- document assumptions required to run pi from `awb`

Concrete steps:

1. Read pi SDK docs relevant to embedding, sessions, and extension/runtime integration.
2. Add a local adapter module for pi initialization.
3. Decide whether `awb` should:
   - host pi directly in-process, or
   - communicate with a local pi-backed service boundary
4. Start with the simplest viable interaction:
   - initialize pi integration
   - show ready/error state
   - optionally seed context from selected ticket
5. Keep the panel functional even if pi is unavailable.

Important constraint:

- the panel must degrade gracefully if pi is not configured or cannot start

## Phase 3 — `awb-vqm7`: architecture and follow-up documentation

Deliverables:

- document how the panel works
- document where pi is integrated
- record known limitations and next steps
- mention Glimpse as an optional future companion approach, not the primary panel architecture

Concrete steps:

1. Update `README.md` once the feature exists.
2. Add or update a wiki page describing architecture.
3. Capture future work such as:
   - ticket-aware prompts
   - slash-command equivalents inside `awb`
   - iterative Ralph-style loops
   - background progress UI
   - Glimpse companion experiments

## Recommended file changes

Likely first-pass changes:

- `src/web/App.tsx`
  - add panel open state
  - add toolbar button
  - render `AgentPanel`
- `src/web/styles.css`
  - new panel styles
  - updated split-view layouts
  - responsive behavior
- `src/web/AgentPanel.tsx`
  - panel shell and placeholder content
- `src/web/pi/*`
  - pi adapter code
- `README.md`
  - mention agent panel once implemented
- `wiki/agent-panel-implementation-plan.md`
  - this plan

## Risks and mitigations

### Risk: Graph mode becomes too cramped

Mitigation:

- start with a fixed-width panel
- test on realistic window sizes
- if needed, suppress or collapse Details while Agent is open in Graph mode

### Risk: pi SDK embedding is more complex than expected

Mitigation:

- isolate SDK code behind a small adapter
- keep the UI shell useful before full integration
- document the blocker and choose the smallest fallback

### Risk: panel state becomes tightly coupled to app state

Mitigation:

- keep props minimal
- keep agent runtime state local to the panel adapter layer
- avoid threading the entire app model into pi integration

## Suggested fallback if pi integration is awkward

If direct pi SDK embedding turns out to be awkward in the first pass, do this instead:

1. complete the in-app panel shell anyway
2. use a mock adapter or local placeholder service boundary
3. keep ticket context and UX stable
4. document the exact pi blocker
5. resume with the smallest viable integration path

This keeps `awb-kg0z` valuable even if `awb-vxxn` needs more investigation.

## Follow-up ideas after MVP

- selected-ticket-aware prompt templates
- start agent work directly from the selected ticket
- show agent logs, commentary, and outputs in the panel
- allow attaching multiple selected tickets
- queue ticket execution loops
- project-local pi extension integration for Ralph-style workflows
- optional Glimpse-based status companion outside the main window

## Recommended next action

Start with `awb-kg0z` first.

That gives `awb` a real panel surface and a stable integration target for `awb-vxxn`.

Once that is in place, read the pi SDK docs in detail and implement the thinnest possible adapter for the first live integration.
