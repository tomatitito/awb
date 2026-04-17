---
id: tv-k8wm
status: closed
deps: [tv-kbwn]
links: [tv-2b97, tv-7g4i, tv-kbwn]
created: 2026-04-13T09:13:59Z
type: task
priority: 2
parent: tv-1mg4
tags: [implementation-plan]
---
# Support CLI options for directory, tickets dir, port, and browser opening

Support --dir, --tickets-dir, --port, and --no-open with the documented defaults for local usage.

## Acceptance Criteria

- The CLI accepts --dir, --tickets-dir, --port, and --no-open.
- Defaults match the documented current directory, .tickets, port 4312, and browser auto-open behavior.
- Invalid or missing ticket directory input produces a clear terminal error.
