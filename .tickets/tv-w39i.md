---
id: tv-w39i
status: closed
deps: [tv-eq0d, tv-0y0u]
links: [tv-7t4f, tv-7g4i]
created: 2026-04-13T09:35:40Z
type: feature
priority: 2
tags: [devx, watcher]
---
# Add hot reloading when ticket files change

Reload awb automatically when files in the configured tickets directory change so the browser reflects ticket edits without needing a full manual restart.

## Acceptance Criteria

- Changes to ticket Markdown files are detected while awb is running.
- The browser updates ticket data automatically or prompts a lightweight refresh without requiring a manual server restart.
- File watching behaves against the configured tickets directory, not only the default .tickets path.

