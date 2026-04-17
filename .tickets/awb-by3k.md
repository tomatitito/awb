---
id: awb-by3k
status: open
deps: []
links: []
created: 2026-04-17T13:45:23Z
type: feature
priority: 2
assignee: Jens Kouros
tags: [ui, tickets, status]
---
# Add clickable ticket status controls

Allow a ticket's status to be changed directly from the UI via a clickable control on the ticket surface.


## Notes

**2026-04-17T13:45:27Z**

Design discussion needed before implementation. We want users to be able to change ticket status via a clickable element on the ticket itself, but the interaction model is still open. Topics to decide: where the control appears in Graph/Kanban/Details views, whether it should be a compact dropdown, segmented buttons, or an inline status badge menu, which statuses should be offered, how to handle invalid transitions, whether changes should write directly to the ticket file immediately, and how to reflect optimistic/pending/error states in the UI.
