---
id: awb-q1ng
status: closed
deps: [awb-4m8h]
links: []
created: 2026-05-03T10:33:41Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-3h1d
tags: [release, packaging, web, test, build]
---
# Add a release smoke test for the compiled AWB binary web UI

Add an automated smoke test that exercises an installed/compiled AWB binary and verifies both the API and browser entrypoint work. This regression escaped because the current release flow validated startup enough to expose /api/tickets but not enough to catch that / and frontend assets 404 in the installed binary.

## Acceptance Criteria

The release/test workflow starts a compiled awb binary and verifies /api/tickets returns 200. The same workflow verifies / returns 200 and that the built HTML can load its referenced frontend assets. The smoke test runs automatically in the release/build validation path so missing embedded/static assets fail the build.


## Notes

**2026-05-03T17:35:12Z**

Implemented via red/green TDD. Added src/releaseSmoke.ts plus tests/releaseSmoke.test.ts and scripts/release-smoke-test.ts to launch a compiled awb binary, verify /api/tickets returns 200, verify / returns 200, and fetch referenced local frontend assets to ensure they load successfully. Wired the smoke test into scripts/build-release-artifact.ts and CI so native compiled artifacts are exercised automatically before packaging. Also updated the self-update fixture to include pi-package/package.json and verified with: bun test; bun run check --max-diagnostics=20; bun scripts/build-release-artifact.ts --platform=darwin --arch=x64 --target=bun-darwin-x64 --archive=tar.gz
