---
id: tv-nvfy
status: open
deps: []
links: [tv-z28d]
created: 2026-04-29T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: tv-et04
tags: [devx, quality, hooks]
---
# Restore a clean pre-commit path without `--no-verify`

It is not acceptable that routine commits require `--no-verify` to bypass repository checks. The pre-commit path needs to be trustworthy on a normal working tree so small targeted changes can be committed without skipping validation.

## Acceptance Criteria

- `bun run check` passes on the repository without relying on `--no-verify`.
- pre-commit hooks allow a normal `git commit` for clean, valid changes.
- Existing repo-wide lint, format, and type issues that currently block unrelated commits are fixed or the hook scope is adjusted so it only enforces relevant changed files.
- The intended local commit workflow is documented if any non-obvious constraints remain.
