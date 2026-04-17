---
id: tv-qmub
status: open
deps: []
links: []
created: 2026-04-13T18:13:03Z
type: bug
priority: 3
assignee: Jens Kouros
parent: tv-et04
tags: [cli, reliability, review]
---
# Validate CLI options and handle server listen failures

CLI parsing accepts invalid port values such as NaN and silently falls back for some missing option values. startServer resolves only on listen success and does not reject cleanly on errors like EADDRINUSE.

## Acceptance Criteria

Invalid or missing option values produce clear CLI errors. Port values are validated before server startup. Server listen errors reject startServer and surface a useful message. The behavior is covered by Bun tests where practical.

