---
id: awb-dn7h
status: closed
deps: []
links: []
created: 2026-04-17T13:06:47Z
type: bug
priority: 1
assignee: Jens Kouros
tags: [agent, panel, pi-sdk, state]
---
# Fix agent panel streaming state after run completion

Ensure the AWB agent panel reflects pi session completion correctly. After a prompt finishes, the panel can report status=ready while isStreaming remains true, which leaves the UI in a contradictory state and can keep controls disabled.

## Acceptance Criteria

- after a completed agent run, the server reports isStreaming=false\n- panel status and isStreaming stay consistent across prompt completion and abort flows\n- bun run build succeeds

