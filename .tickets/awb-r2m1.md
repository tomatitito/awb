---
id: awb-r2m1
status: open
deps: []
links: [awb-f8c4, awb-v3k9]
created: 2026-04-29T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-2u7f
tags: [cli, updates, github, caching]
---
# Detect newer AWB versions from GitHub Releases and surface update notices

Implement phase 1 of the update story: detect whether a newer AWB version exists on GitHub Releases, cache the result locally, and surface a non-blocking notice to the user.

## Acceptance Criteria

- AWB determines its current version from `package.json`/build metadata.
- AWB treats the `package.json` version as the source of truth for update comparison.
- AWB fetches the latest GitHub Release metadata for `tomatitito/awb`.
- The default release-check endpoint is `https://api.github.com/repos/tomatitito/awb/releases/latest`.
- Version comparison uses semver semantics.
- Update-check results are cached locally with a TTL in a user-level cache location rather than per-project state.
- Startup does not block or fail when GitHub is unreachable, rate-limited, or offline.
- AWB can expose a manual `Check for updates` action that refreshes or bypasses the cache.
- When a newer version exists, AWB surfaces a clear notice with the current version, latest version, and recommended next step.
- When no newer version exists, AWB does not show noisy output during normal startup.
- Automated tests cover version comparison and cache behavior where practical.
- `bun test` passes.
- `bun run build` succeeds.

## Notes

- Start with GitHub Releases, not HTML/tag scraping.
- Use a user-level cache file, not a file inside the current project.
- Ignore prereleases during normal checks unless a future update channel feature is added.
- Keep failures silent unless the user explicitly requested a check.
- This ticket should not perform in-place installation of updates.
