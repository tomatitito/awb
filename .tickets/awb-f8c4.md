---
id: awb-f8c4
status: closed
deps: []
links: [awb-r2m1, awb-v3k9]
created: 2026-04-29T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-2u7f
tags: [releases, packaging, distribution, updates]
---
# Define supported install and update channels for AWB self-update

Before implementing true self-update, define which installation methods AWB can safely update in place and what release artifacts AWB must publish to support that.

## Acceptance Criteria

- Supported install methods for self-update are explicitly defined.
- Unsupported install methods are explicitly defined.
- AWB's release version source of truth is explicitly defined as the version in `package.json`.
- The release automation trigger is explicitly defined: when a new `package.json` version is pushed to GitHub, CI creates the corresponding GitHub Release.
- AWB's preferred release distribution format for self-update is documented.
- Platform expectations are documented at least for macOS, Linux, and Windows if relevant.
- The manual upgrade path is defined for unsupported installs.
- If GitHub Release assets are required, the expected artifact naming and metadata are documented.
- Integrity verification expectations are documented, including checksums and any signing requirements if desired.
- Atomic replacement and failure-recovery expectations are documented.
- The output is captured in a repo doc or wiki page linked from this ticket.
- `wiki/awb-self-update-design.md` is updated to reflect the agreed support policy and artifact model.

## Notes

- Initial design doc: `wiki/awb-self-update-design.md`
- This ticket should also define how GitHub Releases are created from version bumps in `package.json`.
- This ticket is primarily design/documentation unless a small amount of supporting code is needed.
- The main goal is to avoid implementing a fragile self-update path for Bun/npm/global installs without a clear support policy.

## Notes

**2026-04-29T13:40:00Z**

Updated `wiki/awb-self-update-design.md` to define the support boundary explicitly: in-place self-update is supported only for managed standalone GitHub Release artifact installs, while Bun/npm/global/dev/package-manager installs are detect-only plus manual upgrade guidance. Documented `package.json` as the release version source of truth, the CI release trigger on pushed version bumps, preferred archive-based distribution, artifact naming, checksum/integrity expectations, platform expectations for macOS/Linux/Windows, and atomic replacement/failure-recovery requirements. Linked the design page from `wiki/wiki.md`. Verified repo checks still pass with `bun run check --max-diagnostics=20` and `bun test`.
