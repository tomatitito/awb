---
id: awb-v3k9
status: closed
deps: [awb-f8c4, awb-r2m1]
links: [awb-r2m1, awb-f8c4]
created: 2026-04-29T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-2u7f
tags: [cli, self-update, releases, packaging]
---
# Implement explicit `awb self-update` for supported install methods

Implement the explicit self-update flow for AWB after the supported install/update channels and release artifact model are defined.

## Acceptance Criteria

- AWB exposes an explicit `awb self-update` command.
- AWB never updates itself automatically without explicit user action.
- AWB detects whether the current installation method supports in-place self-update.
- For supported installs, AWB downloads the correct platform artifact from GitHub Releases.
- Downloaded artifacts are verified before replacement.
- Executable replacement is atomic or safely recoverable on failure.
- On success, AWB clearly reports the installed version.
- On failure, AWB leaves the existing installation usable and reports a clear error.
- For unsupported installs, AWB prints the correct manual upgrade instructions instead of attempting an unsafe overwrite.
- Automated tests cover install-method detection and core update decision logic where practical.
- `bun test` passes.
- `bun run build` succeeds.

## Notes

- This ticket depends on both update detection and the release/distribution design.
- If needed, platform-specific implementation details can be split further later.

## Notes

**2026-04-29T14:05:00Z**

Used red/green TDD with `tests/selfUpdate.test.ts` to cover install-method detection, release artifact selection, checksum parsing, safe executable replacement, and managed-install update flow. Added `src/selfUpdate.ts` with explicit `awb self-update` logic for supported managed GitHub Release installs, including checksum verification, archive extraction, and recoverable replacement. Unsupported installs now print targeted manual upgrade instructions instead of attempting mutation. Wired the new command through `src/cli.ts`, documented it in `README.md`, and updated `wiki/awb-self-update-design.md` to note the adjacent `awb-install.json` metadata expected for managed installs. Verified with `bun test`, `bun run build`, and `bun run check --max-diagnostics=20`.
