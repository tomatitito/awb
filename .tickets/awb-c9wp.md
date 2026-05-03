---
id: awb-c9wp
status: open
deps: []
links: [awb-4eqo]
created: 2026-05-03T10:34:50Z
type: epic
priority: 1
assignee: Jens Kouros
tags: [release, packaging, web, build, install]
---
# Harden AWB compiled release packaging and runtime asset delivery

Track the work required to make compiled AWB releases reliable end to end, with particular focus on bundling/embedding the browser UI, removing runtime filesystem assumptions from installed binaries, and validating release artifacts with executable smoke tests.

## Acceptance Criteria

Compiled AWB releases can serve both API and browser UI successfully after installation. Release/runtime packaging for the browser frontend is explicitly implemented and documented. Release validation includes executable smoke coverage that would catch missing frontend assets before publication. Child tickets cover the concrete implementation and validation tasks needed to close the release UI regression.

