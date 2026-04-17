---
id: tv-7g4i
status: open
deps: [tv-eq0d, tv-kbwn]
links: [tv-2b97, tv-k8wm, tv-kbwn, tv-7t4f, tv-w39i]
created: 2026-04-13T09:13:59Z
type: task
priority: 2
tags: [implementation-plan]
---
# Print a concise startup summary with loaded ticket totals and dependency health

Print a short startup summary after loading tickets so users can quickly confirm what was parsed and whether dependency health looks sane.

## Acceptance Criteria

- Running the CLI prints a concise startup summary during normal startup.
- The summary includes total tickets and at least one useful readiness or dependency-health signal.
- The output stays brief and does not interfere with normal viewer startup.
