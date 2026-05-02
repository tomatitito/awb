---
id: awb-byha
status: closed
deps: []
links: []
created: 2026-05-02T14:45:28Z
type: chore
priority: 2
assignee: Jens Kouros
parent: awb-n6q3
tags: [backend, server, refactor]
---
# Extract server SSE event hubs

Move server-side SSE client bookkeeping and event broadcasting out of src/server.ts into a dedicated module so the HTTP server remains focused on route wiring.

## Acceptance Criteria

- Add a dedicated SSE module for ticket reload and agent event streams.
- Preserve existing SSE event payloads and ready messages.
- Server shutdown closes all SSE clients through the new hubs.
- Build, check, and project-switching tests pass.

