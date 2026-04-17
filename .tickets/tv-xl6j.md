---
id: tv-xl6j
status: open
deps: []
links: []
created: 2026-04-13T18:12:37Z
type: bug
priority: 1
assignee: Jens Kouros
parent: tv-et04
tags: [security, privacy, markdown, review]
---
# Restrict remote resources in rendered ticket markdown

DetailsView renders ticket body markdown with ReactMarkdown. Raw HTML is not enabled, but markdown images and external links can still cause browser requests or send users to unexpected remote targets when viewing tickets from a cloned/shared project.

## Acceptance Criteria

Remote images are blocked, stripped, or explicitly whitelisted by default. External links use a deliberate policy for allowed schemes and rel/target attributes. The markdown policy is covered by tests or component-level verification. Ticket bodies remain readable for normal local markdown.

