---
id: awb-yu10
status: closed
deps: []
links: []
created: 2026-04-21T19:57:45Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-u496
tags: [agent, modularity, architecture]
---
# Narrow AuthStorage passed to createSession to a focused CredentialProvider interface

In AgentController.ts (line ~271-276), createSession receives the full AuthStorage from LoginController. This leaks responsibilities and violates the Principle of Least Privilege. A narrow CredentialProvider interface (e.g. { getCredentials(providerId: string): Credentials }) should be defined. AuthStorage would implement it, and only the narrowed interface would be passed to createSession, keeping full auth flow ownership in LoginController.

## Acceptance Criteria

- A CredentialProvider (or similar) interface is defined with only the methods createSession needs
- AuthStorage implements the interface
- createSession receives the narrow interface, not the full AuthStorage
- LoginController retains full ownership of auth flows

