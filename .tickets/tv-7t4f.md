---
id: tv-7t4f
status: open
deps: [tv-fvrl, tv-0y0u]
links: [tv-fvrl, tv-la01, tv-7g4i, tv-w39i]
created: 2026-04-13T09:13:59Z
type: task
priority: 2
tags: [implementation-plan]
---
# Add graceful empty and error states across the app

Handle empty ticket sets and API load failures with clear UI messaging instead of only console output or generic empty selections.

## Acceptance Criteria

- The UI shows a clear empty state when no tickets are available after load or filtering.
- API load failures are surfaced in the interface with actionable messaging.
- The CLI and UI avoid leaving the user with only silent console failures for expected error cases.
