# AWB self-update design

## Goal

Allow AWB to detect newer releases on GitHub and support a safe explicit self-update flow only for installation methods AWB can reliably manage.

## Principles

- no silent auto-update
- no forced upgrade on startup
- explicit user action for installation of updates
- soft-fail behavior when offline or when GitHub is unavailable
- never mutate installs AWB cannot confidently replace

## Version and release source of truth

- the AWB version is declared in `package.json`
- `package.json` is the source of truth for release versioning
- when a new version in `package.json` is pushed to GitHub, CI should create the corresponding GitHub Release
- AWB should compare its local version against the latest published GitHub Release version

## Release source and cache location

- canonical GitHub repository: `tomatitito/awb`
- default release-check endpoint: `https://api.github.com/repos/tomatitito/awb/releases/latest`
- normal update checks should ignore prereleases
- update-check results should be cached in a user-level cache location, not inside the current project

## Phases

### Phase 1: detection

AWB should:

- know its current version from `package.json`/build metadata
- query GitHub Releases for the latest stable version
- compare versions with semver
- cache results locally with a TTL in a user-level cache
- show a non-blocking update notice when a newer version exists
- provide a manual "Check for updates" path

### Phase 2: self-update

AWB should expose `awb self-update`, but only perform in-place replacement for supported install channels.

## Supported vs unsupported install channels

### Preferred supported channel

The cleanest long-term self-update path is:

- AWB publishes platform-specific release artifacts on GitHub Releases
- AWB installs from one of those managed artifacts
- AWB can later replace that executable with a newer artifact from the same channel

Examples:

- standalone macOS binary/archive
- standalone Linux binary/archive
- standalone Windows executable/archive

### Unsupported channels for in-place self-update

These should usually not be overwritten directly by AWB:

- `bun install -g ...`
- `npm install -g ...`
- linked/dev installs
- source checkouts run directly from the repository
- package-manager-managed installs where file ownership/location is not under AWB's control

For unsupported installs, AWB should print the correct manual upgrade command instead.

## Release artifact expectations

If self-update is supported, GitHub Releases created from `package.json` version bumps should provide:

- versioned artifacts per platform/architecture
- a predictable naming scheme
- checksums for all artifacts
- enough metadata for AWB to choose the right artifact

Example naming shape:

- `awb-darwin-arm64.tar.gz`
- `awb-darwin-x64.tar.gz`
- `awb-linux-x64.tar.gz`
- `awb-windows-x64.zip`
- `checksums.txt`

Exact names can be decided later, but they must be stable and machine-selectable.

## Update flow

For supported installs:

1. resolve current platform/architecture
2. fetch latest release metadata from GitHub
3. choose matching artifact
4. download artifact and checksum data
5. verify integrity
6. extract/stage replacement in a temporary location
7. replace executable atomically if possible
8. keep recovery behavior if replacement fails
9. report success with the new version

For unsupported installs:

1. detect install method
2. do not download or overwrite binaries
3. print the recommended manual upgrade command

## Safety requirements

- integrity verification via checksums is required
- replacement must be atomic or safely recoverable
- a failed update must not leave AWB broken
- user-visible errors should be clear and actionable

Optional later hardening:

- signature verification
- rollback to previous executable
- release channels such as stable/beta

## Recommendation

Implement in this order:

1. detection, cache, and update notice
2. release automation from `package.json` version bumps plus supported-install policy and artifact design
3. explicit `awb self-update` for managed release artifacts only
