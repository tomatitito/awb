---
id: awb-pkgd
status: closed
deps: []
links: []
created: 2026-05-03T00:00:00Z
type: task
priority: 2
assignee: Jens Kouros
tags: [release, install, pi, packaging]
---
# Move AWB runtime pi package metadata into the user config directory

Ensure installed AWB releases provide the package metadata required by the embedded pi SDK without depending on files next to the executable.

## Acceptance Criteria

- Release artifacts include runtime package metadata for installed builds.
- The installer places that metadata in the AWB user config directory.
- AWB sets `PI_PACKAGE_DIR` before importing the pi SDK.
- Self-update refreshes the runtime package metadata alongside the executable.
- macOS honors `XDG_CONFIG_HOME` when it is set.

## Notes

**2026-05-03T12:00:00Z**

Added a bootstrap entrypoint that sets `PI_PACKAGE_DIR` and `AWB_PACKAGE_DIR` before the CLI loads. Release artifacts now ship `pi-package/package.json`, the installer copies it into the AWB user config directory, and self-update refreshes the same metadata after replacing the executable. AWB now resolves its own version from the installed runtime package metadata when available. macOS config resolution was also updated to honor `XDG_CONFIG_HOME`.
