---
id: awb-p9t2
status: closed
deps: [awb-8k2m, awb-j6r4]
links: [awb-3n5p]
created: 2026-04-18T00:00:00Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3n5p
tags: [agent, runs, transcript, history, mobile, ui]
---
# Show live and historical agent run details in the Agents tab

Users should be able to inspect running agent runs live and read completed run transcripts after the fact. The Agents tab should provide a run detail view that opens when a run row is selected.

For active runs, the detail view should be interactive. For completed, failed, and aborted runs, the detail view should remain readable but be read-only in v1.

## UX Outline

- desktop and tablet use a list + detail split view in the Agents tab
- mobile uses a simple drill-down from run list to run detail with a back path
- clicking any run row opens that run’s detail view, whether the run is active or already completed
- running runs show live transcript and tool activity and allow follow-up prompts / stop actions
- completed runs still show transcript and tool activity but are read-only

## Acceptance Criteria

- clicking a run row opens its detail view for active and completed runs alike
- running runs show live transcript and tool activity
- running runs allow follow-up prompt and stop actions
- completed runs still show transcript and tool activity after they finish
- completed, failed, and aborted runs are read-only in v1
- desktop/tablet detail view works alongside the run list
- mobile run detail has a simple back path to the run list
- `bun run build` succeeds

## Likely Touchpoints

- `src/web/workspace.tsx`
- `src/web/layouts.tsx`
- `src/web/styles.css`
- `src/web/AgentPanel.tsx`
- `src/web/useAgentPanel.ts`
- `src/web/mobileFlow.ts`
- `src/web/agentApi.ts`
