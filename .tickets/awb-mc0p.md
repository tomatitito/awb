---
id: awb-mc0p
status: in_progress
deps: []
links: []
created: 2026-04-17T12:17:50Z
type: chore
priority: 2
assignee: Jens Kouros
---
# Pin all dependencies and update them to current versions

Review all direct dependencies, pin versions instead of loose ranges where applicable, and update them to current stable releases. Refresh lockfile and verify the project still builds and tests cleanly with Bun.

## Acceptance Criteria

- all direct dependencies in package.json are pinned to explicit versions
- dependencies are updated to current stable releases where feasible
- bun.lock is refreshed
- bun run build succeeds
- bun test passes or any remaining failures are documented in the ticket


## Notes

**2026-04-17T12:19:42Z**

Updated package.json to pin all direct deps and refreshed bun.lock. Bumped dependencies to latest stable versions that remain compatible with the current toolchain, including Vite 6.4.2/@vitejs/plugin-react 5.2.0 (Vite 8 requires Node 22.12+, but this environment is on Node 22.11.0). Verified: bun run build passes. bun test currently reports no matching test files in the repository, so there is no existing Bun test suite to run.
