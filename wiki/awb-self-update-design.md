# AWB self-update design

Related tickets:

- `awb-f8c4` — define supported install and update channels for AWB self-update
- `awb-r2m1`
- `awb-v3k9`

## Goal

Define a safe support policy for AWB self-update before implementing in-place updater behavior.

The primary goal is to avoid a fragile updater that attempts to mutate installs owned by Bun, npm, source checkouts, or other package managers. AWB should only self-update when it can confidently replace its own installed artifact.

## Source of truth for versions and releases

### Version source of truth

AWB's release version source of truth is the `version` field in `package.json`.

Rules:

- `package.json` is the canonical version for releases
- built artifacts and runtime update checks should report that version
- Git tags and GitHub Release names should correspond to the same version
- AWB should compare its local version against GitHub Release metadata derived from the same version

### Release automation trigger

Release automation is triggered by a version bump in `package.json` being pushed to GitHub.

Expected CI behavior:

1. CI detects that the pushed commit contains a new `package.json` version
2. CI builds the release artifacts for the supported platforms
3. CI computes checksums for all artifacts
4. CI creates the corresponding GitHub Release for that exact version
5. CI uploads artifacts and checksum metadata to that Release

Expected GitHub Release naming policy:

- tag: `v<version>`
- release title: `AWB v<version>`

Example:

- `package.json` version: `0.2.3`
- git tag: `v0.2.3`
- GitHub Release title: `AWB v0.2.3`

## Supported self-update install methods

AWB self-update is supported only for **managed standalone release-artifact installs** downloaded from AWB GitHub Releases.

Supported channel definition:

- the user installed AWB from an official GitHub Release artifact published by AWB
- the installation is a standalone executable or standalone archive extracted to a user-controlled location
- the installed binary can determine that it came from this managed channel
- AWB has permission to replace the installed executable in place

This is the only supported in-place self-update channel in the initial policy.

### Preferred release distribution format

The preferred distribution format for self-update is:

- platform-specific standalone archives published on GitHub Releases
- each archive contains the AWB executable plus a small manifest file if needed
- AWB updates by downloading the next matching archive, extracting it to a staging location, and atomically replacing the executable

Why archives are preferred over raw binaries:

- easier to include future metadata files
- better cross-platform packaging consistency
- room for bundled helpers if needed later
- easier checksum/signature workflows at the artifact level

## Unsupported self-update install methods

The following install methods are explicitly unsupported for in-place self-update:

- `bun install -g awb`
- `npm install -g awb`
- any future package-manager-managed global install
- linked installs such as `npm link` or equivalent
- source checkouts run directly from the repository
- development invocations such as `bun src/cli.ts --dev`
- installs owned by system package managers such as Homebrew, apt, pacman, winget, scoop, chocolatey, or similar
- installs in directories AWB cannot write to safely
- unknown install origins where AWB cannot prove it is a managed standalone release install

Policy:

- AWB must not attempt to overwrite these installs
- AWB may still perform update detection for them
- AWB must surface a clear manual upgrade path instead of mutating the installation

## Manual upgrade path for unsupported installs

For unsupported installs, `awb self-update` should fail safely with a targeted message.

Expected behavior:

- identify the likely install channel when possible
- explain that in-place self-update is not supported for that channel
- print the recommended manual upgrade command or instructions

Examples:

- Bun global install: `bun install -g awb@latest`
- npm global install: `npm install -g awb@latest`
- source checkout: `git pull` followed by `bun install` and `bun run build` as appropriate
- package-manager installs: direct the user back to that package manager's upgrade flow
- unknown install origin: direct the user to download the latest GitHub Release artifact manually

## Platform expectations

### macOS

Supported managed artifacts should be published at least for:

- `darwin-arm64`
- `darwin-x64`

Expectations:

- archive format should likely be `.tar.gz` or `.zip`
- unsigned binaries are acceptable initially if documented, but signing/notarization is desirable later
- updater must preserve executable permissions on replacement

### Linux

Supported managed artifacts should be published at least for:

- `linux-x64`
- optionally `linux-arm64` later if AWB wants first-class ARM Linux support

Expectations:

- archive format should likely be `.tar.gz`
- binaries should target a conservative compatibility baseline where feasible
- updater must preserve executable permissions on extraction and replacement

### Windows

Windows support is relevant to the policy even if initial implementation lags.

Supported managed artifacts, if shipped, should be published at least for:

- `windows-x64`
- optionally `windows-arm64` later

Expectations:

- archive format should likely be `.zip`
- executable name should be `awb.exe`
- replacement logic must account for Windows file-locking behavior and may require rename-on-restart or temp-file swap logic

If Windows self-update is not implemented in the first shipping iteration, the documentation should still treat it as a planned supported platform for release artifacts while allowing self-update behavior to remain detect-only there until replacement semantics are hardened.

## Artifact model for GitHub Releases

Self-update requires predictable GitHub Release assets.

### Required assets

For each release version, GitHub Releases should publish:

- one archive per supported platform/architecture pair
- one checksums file covering all archives
- optional metadata manifest for machine selection if AWB later wants a richer asset lookup path

### Expected artifact naming

Preferred artifact naming scheme:

- `awb-v<version>-darwin-arm64.tar.gz`
- `awb-v<version>-darwin-x64.tar.gz`
- `awb-v<version>-linux-x64.tar.gz`
- `awb-v<version>-linux-arm64.tar.gz` if published
- `awb-v<version>-windows-x64.zip`
- `awb-v<version>-windows-arm64.zip` if published
- `awb-v<version>-checksums.txt`

Examples:

- `awb-v0.2.3-darwin-arm64.tar.gz`
- `awb-v0.2.3-linux-x64.tar.gz`
- `awb-v0.2.3-windows-x64.zip`
- `awb-v0.2.3-checksums.txt`

### Expected asset metadata

At minimum, AWB must be able to derive or read:

- version
- operating system
- architecture
- archive format
- download URL
- checksum algorithm
- checksum value

This can come from either:

- stable file naming conventions alone, or
- a future release manifest asset such as `awb-v<version>-manifest.json`

Initial preference:

- start with stable naming plus `checksums.txt`
- add a manifest later only if selection logic becomes too brittle

## Integrity verification policy

Integrity verification is required before replacement.

### Required verification

- every release archive must be covered by a published checksum
- AWB must verify the downloaded archive checksum before extraction or replacement
- checksum verification failure must abort the update

Preferred checksum policy:

- SHA-256
- checksums file format should be simple and machine-readable

Example:

```txt
<sha256>  awb-v0.2.3-darwin-arm64.tar.gz
<sha256>  awb-v0.2.3-linux-x64.tar.gz
<sha256>  awb-v0.2.3-windows-x64.zip
```

### Optional signing policy

Signing is optional for the first implementation, but the policy should leave room for it.

Desirable later hardening:

- signed checksums file
- platform-native code signing where appropriate
- macOS notarization
- Windows Authenticode signing

If signing is not initially implemented, the docs should state that checksum verification is the minimum required integrity check.

## Atomic replacement and failure recovery

Self-update must never leave AWB half-installed.

### Replacement expectations

For supported installs, the updater should:

1. download the matching archive to a temp directory
2. verify the checksum
3. extract to a staging directory
4. verify the expected executable exists in the staged payload
5. rename the current executable to a backup path when needed
6. atomically move the staged executable into the final location where the platform allows it
7. clean up temp files after success

### Failure recovery expectations

If replacement fails:

- the existing AWB executable should remain usable, or
- AWB should restore from the backup executable before exiting

Minimum acceptable policy:

- no failed update may leave the main executable missing
- cleanup of temp files may be best-effort
- cleanup failure must not count as a broken install if the primary executable is intact

Windows-specific note:

- true atomic replacement may not match POSIX semantics because running executables can be locked
- Windows may require a slightly different swap strategy or a delayed replacement helper
- that does not change the support policy; it only affects implementation details

## Detection and policy decisions in the updater

`awb self-update` should perform three major decisions:

1. determine the current installed version
2. determine the current install channel
3. decide whether in-place update is supported for that install channel

Recommended runtime outcomes:

- **managed standalone release install** → supported self-update path
- **known unsupported install** → no mutation, print manual upgrade instructions
- **unknown install origin** → treat as unsupported and fail safely

## User-facing policy summary

The CLI and docs should present the policy clearly:

- AWB can always check for updates
- AWB can only self-update installs created from official managed GitHub Release artifacts
- Bun/npm/global/dev/package-manager installs must be upgraded manually

## Recommended phased rollout

1. keep update detection separate from update installation
2. ship release automation from `package.json` version bumps first
3. publish stable GitHub Release artifacts plus checksums
4. implement `awb self-update` only for managed standalone release installs
5. leave unsupported channels on manual upgrade flows indefinitely unless AWB later adds first-class package-manager integrations

## Open choices intentionally left for later

These do not block the support policy:

- whether archives are `.tar.gz` or `.zip` on macOS
- whether a manifest file is needed in addition to checksum files
- whether Windows in-place replacement ships in the first implementation or a follow-up
- whether signing/notarization ships in v1 or later

The key point is that the support boundary is now explicit: **self-update is for managed GitHub Release artifacts only; all other install channels are detect-only plus manual upgrade guidance.**
