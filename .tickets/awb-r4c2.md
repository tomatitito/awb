---
id: awb-r4c2
status: closed
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

**2026-05-02T12:10:00Z**

Polished the multi-project feature by documenting the user-level allowlist, selector behavior, empty/malformed config handling, and the current non-persistent selection model in `README.md`. Expanded automated coverage in `tests/projects.test.ts` and `tests/server.projectSwitch.test.ts` for malformed config, empty allowlists, and switching guardrails, while keeping the UI selector coverage in `tests/web/projectSelector.test.tsx`. Verified with `bun run check --max-diagnostics=20`, targeted Bun tests, and `bun run build`.
