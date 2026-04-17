---
id: awb-kg0z
status: closed
deps: []
links: []
created: 2026-04-16T21:33:20Z
type: feature
priority: 1
parent: awb-7vzs
tags: [agent, panel, ui]
---
# Add agent panel layout and toggle controls

Add the UI affordance and layout changes needed to show and hide an agent panel in awb. The initial implementation should add a button to toggle the panel and render the panel on the right without regressing the existing Graph, Kanban, and Details views.

## Acceptance Criteria

- A visible control allows the user to toggle the agent panel.
- When enabled, the agent panel renders on the right side of the main app layout.
- When disabled, the layout returns to the current non-panel state.
- Existing ticket browsing views remain usable with the panel open and closed.

