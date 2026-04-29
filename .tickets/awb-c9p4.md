---
id: awb-c9p4
status: open
deps: []
links: [tv-nvfy]
created: 2026-04-29T00:00:00Z
type: epic
priority: 1
assignee: Jens Kouros
tags: [code-quality, biome, lint, a11y, types]
---
# Make `bun run check` pass repo-wide again

Restore a clean repo-wide Biome check so `bun run check` succeeds without exceptions and the repo no longer carries a backlog of known lint/a11y/type issues.

This epic follows the pre-commit fix from `tv-nvfy`. The hook now checks only changed staged files, which unblocks normal commits, but the repository still has remaining Biome diagnostics that should be fixed properly.

## Scope

- fix the remaining manual Biome issues that auto-fix could not safely resolve
- keep the existing pre-commit workflow intact
- preserve current app behavior while improving type-safety, semantics, and accessibility

## Acceptance Criteria

- `bun run check` passes on the full repository
- `bun test` passes
- remaining Biome diagnostics are resolved without relying on `--no-verify`
- semantic/a11y fixes do not regress current Graph, Kanban, Details, or Agent interactions

## Notes

Biome auto-fix already cleaned up formatting/import-order noise in several files. The remaining work is the manual bucket: explicit `any`, non-null assertions, hook dependency issues, semantic element/a11y issues, and CSS specificity ordering.

## Child tickets

- `awb-m7d2` — Fix core type-safety and nullability diagnostics
- `awb-j4x6` — Fix React hook and accessibility diagnostics in the web UI
- `awb-t5q1` — Fix CSS descending-specificity diagnostics in `src/web/styles.css`
