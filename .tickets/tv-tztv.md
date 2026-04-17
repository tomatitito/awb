---
id: tv-tztv
status: open
deps: []
links: []
created: 2026-04-13T18:12:28Z
type: task
priority: 1
assignee: Jens Kouros
parent: tv-et04
tags: [tests, bun, review]
---
# Add Bun test coverage for parser, derived data, server, and CLI

bun test currently finds no test files, and package.json has no test script. The parsing and derived-data modules are small but central, and the server/API and CLI argument behavior can regress silently.

## Acceptance Criteria

package.json includes a Bun test script. parseTicket tests cover frontmatter defaults, arrays, headings, and malformed input expectations. deriveData tests cover ready, blocked, missing deps, closed statuses, and reverse deps. Server/API behavior has at least one integration test. CLI argument parsing or validation is testable without launching the browser.

