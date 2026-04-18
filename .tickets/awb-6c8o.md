---
id: awb-6c8o
status: open
deps: []
links: []
created: 2026-04-18T06:24:07Z
type: task
priority: 3
assignee: Jens Kouros
tags: [testing, mobile, maestro, tooling]
---
# Introduce Maestro-based mobile UI regression harness for AWB

Add an actual Maestro-based UI regression harness to AWB so phone-sized responsive flows can be exercised against a running app, rather than only via pure Bun flow-helper tests. This follow-up should be independent from the mobile responsive epic and focus on establishing the Maestro tooling, app launch strategy, stable selectors, and a first end-to-end mobile smoke flow.

## Acceptance Criteria

- Maestro is installed/configured in the repo with documented setup and execution steps
- AWB can be launched in a way Maestro can reliably target for local and CI execution
- at least one Maestro flow covers a core mobile Graph → Details → Agent smoke path using existing stable selectors
- the Maestro flow runs without depending on brittle CSS selectors
- any required test fixtures or scripts for deterministic execution are added and documented
- bun run build succeeds

