---
id: awb-k2h8
status: closed
deps: []
links: []
created: 2026-04-29T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-s4p7
tags: [projects, configuration, discovery]
---
# Define how AWB discovers selectable projects

Design and implement the source of truth for which directories AWB may show in the project selector.

## Acceptance Criteria

- AWB supports a defined discovery model for selectable projects.
- The initial implementation chooses one primary approach and documents rejected alternatives.
- If configuration is used, the config location and schema are defined.
- Directory entries can describe at least the project root and optional display label.
- Invalid, missing, or duplicate entries are handled gracefully.

## Notes

- Prefer an explicit allowlist-style config over unrestricted whole-disk scanning.
- Consider a future path for recents, favorites, or search-based discovery without blocking the first implementation.
- Project-local `.awb/config.json` is not sufficient as the only source because it cannot advertise other projects before switching.

## Notes

**2026-04-29T14:20:00Z**

Used red/green TDD with `tests/projects.test.ts` to define and verify the initial project discovery model. Implemented `src/projects.ts` with a user-level allowlist config (`config.json` in the AWB user config directory), support for `root` plus optional `label`, and graceful handling for missing files, malformed entries, non-existent directories, and duplicates. Added `GET /api/projects` in `src/server.ts` so a future selector can consume the discovered set. Documented the chosen allowlist approach, config locations/schema, and rejected alternatives in `wiki/project-discovery-design.md`, and linked it from `wiki/wiki.md` and `README.md`.
