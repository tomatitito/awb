---
id: awb-f7c1
status: open
deps: [awb-8k2m]
links: [awb-3n5p]
created: 2026-04-18T00:00:00Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3n5p
tags: [agent, runs, graph, kanban, ui, mobile]
---
# Add run button for ready tickets in Graph and Kanban

Ready tickets should be launchable directly from the main planning surfaces. AWB should add a run control for ready tickets in Graph and Kanban that starts a background agent run without opening the existing embedded agent panel.

For desktop, the run control may be hover/focus-revealed near the `ready` badge. For mobile, the control must not depend on hover and should be shown directly on ready cards.

## UX Outline

- only ready tickets expose the run action
- desktop may reveal the green play button on hover/focus near the `ready` badge
- mobile shows the run button directly on ready cards
- clicking the run button starts a background agent run for that ticket
- launching a run does not open the existing agent panel
- launching a run does not navigate away from the current view
- after launch, the button becomes gray/disabled
- clicking the already-disabled control is a no-op and does not create another run

## Acceptance Criteria

- Graph and Kanban both surface a run action for ready tickets
- only ready tickets expose the run action
- clicking run creates a background run for that ticket
- the current page and current tab remain unchanged after launch
- the existing ticket selection behavior still works
- after launch, the button visibly changes from green to gray/disabled
- repeat clicks on the already-disabled control do nothing and do not create another run
- keyboard access works anywhere hover reveal is used
- `bun run build` succeeds

## Likely Touchpoints

- `src/web/workspace.tsx`
- `src/web/styles.css`
- `src/web/layouts.tsx`
- `src/web/App.tsx`
