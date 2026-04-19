---
id: awb-j6r4
status: closed
deps: [awb-8k2m]
links: [awb-3n5p, awb-f7c1]
created: 2026-04-18T00:00:00Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3n5p
tags: [agent, runs, ui, navigation, dashboard]
---
# Add Agents tab with run list and run count indicator

Users need a dedicated place to see active background agent runs and recent completed runs. AWB should add an Agents tab plus a lightweight header indicator so users can tell that runs are active in the background and navigate quickly to inspect them.

This ticket is about the run list and navigation entry points, not the full live transcript/detail experience for a selected run.

## UX Outline

- add a top-level `Agents` tab
- add a concise top bar or mobile header indicator showing the current agent run count
- clicking the indicator opens the Agents tab
- the Agents tab shows active runs first and also keeps recent completed runs visible
- each row shows at least status, ticket id, ticket title, and started time

## Acceptance Criteria

- app navigation includes an `Agents` tab
- desktop and mobile headers show a concise background-agent run count indicator
- clicking the count indicator navigates to the Agents tab
- the Agents tab lists running and recent completed runs
- each run row shows at least:
  - status
  - ticket id
  - ticket title
  - started time
- a clear empty state is shown when no runs exist
- `bun run build` succeeds

## Likely Touchpoints

- `src/web/App.tsx`
- `src/web/layouts.tsx`
- `src/web/workspace.tsx`
- `src/web/styles.css`
