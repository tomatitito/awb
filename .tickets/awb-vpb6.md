---
id: awb-vpb6
status: closed
deps: []
links: []
created: 2026-05-13T20:20:24Z
type: bug
priority: 1
assignee: Jens Kouros
---
# Fix desktop new agent chat composer

On desktop, clicking Agents > New agent chat could appear to do nothing because the composer state toggled closed when it was already initialized open during async run loading.

## Acceptance Criteria

New agent chat always opens the unticketed chat composer and focuses the prompt textarea.

