---
id: awb-439e
status: closed
deps: []
links: []
created: 2026-04-17T12:46:35Z
type: epic
priority: 2
assignee: Jens Kouros
---
# Add automated test coverage for AWB core logic

Establish an initial Bun-based automated test suite covering the most important pure logic and file-loading behavior in AWB so pre-commit hooks can validate changes with confidence.

## Acceptance Criteria

- initial Bun test suite exists in the repository
- coverage includes ticket parsing, derived data, graph derivation, filtering, and file loading behavior
- tests are reliable and runnable via bun test
- follow-up tickets define the concrete coverage areas

