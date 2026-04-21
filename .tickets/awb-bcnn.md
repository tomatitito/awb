---
id: awb-bcnn
status: closed
deps: []
links: []
created: 2026-04-21T19:57:30Z
type: bug
priority: 1
assignee: Jens Kouros
parent: awb-u496
tags: [agent, login, reliability, react]
---
# Replace setInterval login flow polling with recursive setTimeout

In AgentPanel.tsx (lines ~88-104), the login flow polling uses setInterval. If fetchAgentLoginFlow() is slow or throws, the interval keeps firing, causing overlapping concurrent requests. Additionally, the effect depends on loginFlow in its dependency array, so it is constantly torn down and recreated on each state update.

## Acceptance Criteria

- Polling uses recursive setTimeout so the next poll only starts after the previous one completes
- No overlapping concurrent requests can occur
- The effect cleanup correctly cancels any pending timeout

