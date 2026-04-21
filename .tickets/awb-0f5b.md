---
id: awb-0f5b
status: closed
deps: []
links: []
created: 2026-04-21T19:57:24Z
type: bug
priority: 0
assignee: Jens Kouros
parent: awb-u496
tags: [security, agent, login, xss]
---
# Sanitize loginFlow.authUrl to prevent XSS via javascript: URIs

In AgentPanel.tsx, loginFlow.authUrl is rendered directly in an <a href> without validating the URL scheme. React does not sanitize href attributes against javascript: URIs, so if a malicious or misconfigured provider returns a javascript: URI, clicking the link executes arbitrary JS in the user's session.

## Acceptance Criteria

- loginFlow.authUrl is validated to start with https:// or http:// before rendering in href
- Any other scheme is rejected or the link is not rendered
- A unit test covers the validation

