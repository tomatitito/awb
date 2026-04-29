---
id: awb-2u7f
status: open
deps: []
links: []
created: 2026-04-29T00:00:00Z
type: epic
priority: 2
assignee: Jens Kouros
tags: [cli, updates, releases, packaging]
---
# Add GitHub-based update detection and guided self-update for AWB

Allow AWB to detect when a newer version is available on GitHub and guide the user through a safe upgrade path.

This epic tracks the full update story across detection, release/distribution prerequisites, and explicit self-update.

## Goal

Ship this in two deliberate phases:

1. **Update detection and notification**
   - AWB checks GitHub Releases for the latest published version.
   - AWB compares the latest release version with its current version using semver.
   - If a newer version exists, AWB shows a non-blocking notice in the CLI and, where appropriate, in the web UI.
   - Results are cached locally so startup stays fast and offline use remains smooth.

2. **Explicit self-update flow**
   - AWB exposes an explicit `awb self-update` command and optionally a matching UI action.
   - AWB updates itself only when the user requests it.
   - Self-update should prefer platform-specific GitHub Release artifacts rather than trying to mutate arbitrary package-manager installs.
   - If AWB was installed through an unsupported channel, it should print the correct manual upgrade instructions instead.

## Rationale

- Silent background auto-update is too risky for a developer tool.
- Detection and notification are low-risk and immediately useful.
- Reliable self-update requires a controlled distribution story.
- Bun/npm/global installs may not be safely replaceable in place, while GitHub Release binaries are a cleaner long-term target.

## Scope

### In scope

- determining the running AWB version from `package.json`/build metadata
- querying GitHub Releases for the latest stable version from `tomatitito/awb`
- semver comparison between current and latest versions
- user-level local caching of update-check results with TTL
- release automation that turns a newly pushed `package.json` version into a GitHub Release
- soft-fail behavior for offline, rate-limited, or GitHub-error cases
- CLI notice when an update is available
- optional web UI notice or status surface
- explicit `Check for updates` action
- design of a safe `self-update` path tied to supported install methods
- manual upgrade guidance for unsupported install methods

### Out of scope

- silent or automatic background installation of updates
- forced upgrades before AWB can start
- scraping arbitrary web pages for version information
- mutating unsupported installs in place
- silent or fully automatic background installation of updates

## Acceptance Criteria

### Phase 1: detection

- AWB knows its current version.
- AWB uses the version declared in `package.json` as the source of truth for releases.
- AWB knows the configured update source, initially GitHub Releases for `tomatitito/awb`.
- AWB can query the latest GitHub release metadata from `https://api.github.com/repos/tomatitito/awb/releases/latest`.
- AWB compares versions semantically rather than lexically.
- Update checks are cached locally with a reasonable TTL in a user-level cache location rather than per-project state.
- Offline or failed update checks do not block startup and do not surface noisy errors by default.
- When a newer version exists, AWB surfaces a clear non-blocking notice with the current version, latest version, and a recommended upgrade path.
- AWB provides a manual `Check for updates` path that bypasses or refreshes the cache.

### Phase 2: guided self-update

- AWB exposes an explicit `awb self-update` command.
- AWB does not update itself automatically without explicit user action.
- AWB only performs in-place self-update for supported install/distribution methods.
- For supported installs, AWB downloads the correct platform artifact from GitHub Releases.
- The update flow verifies integrity before replacing the executable.
- Replacement is atomic or safely recoverable on failure.
- For unsupported installs, AWB prints clear manual upgrade instructions instead of attempting an unsafe overwrite.

### Release pipeline

- when a change to the AWB version in `package.json` is pushed to GitHub, CI creates the corresponding GitHub Release
- the release process uses the `package.json` version as the release version source of truth

### Delivery

- behavior is covered by automated tests where practical
- `bun test` passes
- `bun run build` succeeds

## Implementation notes

Preferred architecture:

- add a dedicated update service module responsible for:
  - reading current version from `package.json`/build metadata
  - fetching GitHub release metadata from `tomatitito/awb`
  - semver comparison
  - user-level cache persistence and TTL handling
  - install-method detection
  - rendering upgrade guidance
- versioning source of truth should remain `package.json`
- release automation should create GitHub Releases from pushed version bumps rather than requiring a separate manual release step
- start with GitHub Releases instead of scraping tags or pages
- check on startup at most once per TTL window, for example every 24 hours
- also support an explicit user-triggered update check
- keep update-check failures silent unless the user explicitly requested the check

Preferred self-update model:

- support true self-update only once AWB has stable platform-specific release artifacts
- use checksums and atomic replacement
- keep a rollback/recovery path if replacement fails mid-update
- if running from Bun/global package installation, detect that and show the recommended upgrade command instead of attempting to overwrite the install

## Child tickets

- `awb-r2m1` — GitHub release check, cache, and update notice
- `awb-f8c4` — Define supported install/update channels and release artifacts
- `awb-v3k9` — Implement explicit `awb self-update` for supported installs
