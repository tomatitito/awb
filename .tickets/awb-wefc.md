---
id: awb-wefc
status: open
deps: []
links: [awb-2u7f]
created: 2026-05-11T09:13:41Z
type: feature
priority: 1
assignee: Jens Kouros
tags: [ui, updates, self-update, releases]
---
# Add UI check and self-update controls

Add an in-app control that lets users check whether a newer AWB release is available and, when supported, start the explicit self-update flow from the browser UI. This should build on the existing CLI update detection and self-update commands rather than creating a separate update implementation.

## Acceptance Criteria

- The UI exposes a clear Check for updates action in an appropriate global/header/settings location.
- Manual checks bypass or refresh the cached update result and show current version, latest version, and release link when available.
- When an update is available and the current install supports in-place self-update, the UI offers an explicit user-triggered update action.
- Unsupported install methods show targeted manual upgrade instructions instead of attempting mutation.
- Update check and update failures are shown as non-blocking UI errors.
- Tests cover API/server behavior and UI rendering for up-to-date, update-available, unsupported, and failure states.
