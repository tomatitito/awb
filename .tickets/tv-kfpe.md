---
id: tv-kfpe
status: open
deps: []
links: []
created: 2026-04-13T18:12:33Z
type: bug
priority: 1
assignee: Jens Kouros
parent: tv-et04
tags: [parser, reliability, review]
---
# Keep viewer usable when individual ticket files are malformed

loadTickets parses every markdown file in one pass, and parseTicket can throw when gray-matter encounters malformed frontmatter. One bad ticket can break startup or make live reload fail instead of showing the valid tickets plus a useful error.

## Acceptance Criteria

A malformed ticket does not prevent valid tickets from loading. Per-file parse/read errors are captured in the API response or another structured channel. The UI makes ticket load errors visible without replacing valid data. Startup and live reload behavior are covered by tests.

