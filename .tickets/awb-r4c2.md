---
id: awb-r4c2
status: open
deps: [awb-k2h8, awb-n6q3, awb-x1m5]
links: []
created: 2026-04-29T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-s4p7
tags: [projects, docs, tests, persistence]
---
# Document and polish multi-project switching behavior

Cover the operational details around project selection so the feature is understandable and reliable.

## Acceptance Criteria

- README or dedicated docs explain how to configure selectable projects.
- Behavior for missing projects, empty project lists, and malformed config is documented.
- Tests cover config parsing plus key end-to-end switching flows.
- If AWB remembers the last selected project or recent projects, that behavior is documented and tested.
- `bun run build` and relevant Bun tests pass.

## Notes

- Use this ticket to capture final polish once the discovery model and switching mechanics are implemented.
