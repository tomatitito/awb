---
id: awb-qmho
status: closed
deps: []
links: []
created: 2026-04-21T19:57:38Z
type: task
priority: 2
assignee: Jens Kouros
parent: awb-u496
tags: [agent, login, modularity, react]
---
# Extract login/auth section from AgentPanel into a dedicated component

AgentPanel.tsx is growing in responsibility — it now manages prompt queues, run states, tool tracking, and complex multi-step OAuth polling. The entire Subscriptions section (auth providers list, login flow form, polling logic, and local state) should be extracted into an AgentLoginSection or LoginManager component. Pass loginFlow, authProviders, and an onRefresh callback as props.

## Acceptance Criteria

- A new AgentLoginSection (or similar) component owns the auth providers list, login flow UI, and polling
- AgentPanel delegates to the new component via props/callbacks
- No change in user-visible behavior

