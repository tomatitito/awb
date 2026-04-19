---
id: awb-f7c1
status: closed
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
- desktop may reveal the green play button on hover and must also reveal it on keyboard focus near the `ready` badge
- mobile shows the run button directly on ready cards and must not depend on hover
- the control should use an explicit agent-run affordance, e.g. a play icon with an accessible label such as `Start agent run`
- clicking the run button starts a background agent run for that ticket using the default AWB initial prompt generated from the ticket content
- clicking the run button does not open the existing agent panel
- clicking the run button does not navigate away from the current view
- clicking the run button does not trigger the normal ticket selection behavior for the surrounding card or node
- on click, the control immediately enters a pending disabled state so repeat clicks cannot create duplicate runs while the request is in flight
- if launch succeeds, the control remains disabled/gray while a run for that ticket is active (`queued`, `starting`, or `running`)
- if launch fails, the control returns to its enabled state and AWB shows an inline error or toast without navigating away
- clicking the already-disabled control is a no-op and does not create another run
- once no active run exists for the ticket anymore, the button may become available again if the ticket is still in a state where the action is allowed

## Acceptance Criteria

- Graph and Kanban both surface a run action for ready tickets
- only ready tickets expose the run action
- the run action is keyboard accessible, and any hover-revealed control is also revealed on focus
- clicking run creates a background run for that ticket
- launching a run uses the default AWB initial prompt generated from the ticket content rather than requiring manual prompt entry
- the current page and current tab remain unchanged after launch
- clicking the run control does not trigger the existing ticket selection behavior for the surrounding card or node
- on click, the control immediately enters a pending disabled state
- after a successful launch, the button visibly changes from green to gray/disabled while a run for that ticket is active
- if run creation fails, AWB shows an error, restores the enabled state, and does not create a duplicate run
- repeat clicks on the already-disabled control do nothing and do not create another run
- the disabled state is derived from actual active run state for the ticket rather than only local click state
- no prompt editing or prompt preview is required in this launch flow
- `bun run build` succeeds

## Likely Touchpoints

- `src/web/workspace.tsx`
- `src/web/styles.css`
- `src/web/layouts.tsx`
- `src/web/App.tsx`
