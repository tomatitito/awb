---
id: awb-jka5
status: closed
deps: []
links: []
created: 2026-04-21T19:57:51Z
type: bug
priority: 2
assignee: Jens Kouros
parent: awb-u496
tags: [agent, login, react, ux]
---
# Add isSubmitting guard to login prompt form to prevent duplicate submissions

In AgentPanel.tsx (lines ~175-189), the login prompt submission form has no disabled or loading state. Rapid clicks or high network latency will fire multiple identical POST requests, which can cause race conditions and confusing UI states.

## Acceptance Criteria

- An isSubmitting boolean state guards the form submission
- Submit and Cancel buttons are disabled while isSubmitting is true
- isSubmitting is reset in a finally block after the request completes or fails

