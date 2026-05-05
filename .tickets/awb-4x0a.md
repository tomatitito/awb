---
id: awb-4x0a
status: open
deps: [awb-uo30]
links: []
created: 2026-05-05T05:14:41Z
type: feature
priority: 2
assignee: Jens Kouros
parent: awb-uo30
tags: [agent, ui, context]
---
# Attach ticket context from inside an agent chat

After unticketed agent chats exist, let the user pull an existing ticket into the current chat from within the Agents view. This supports starting with a freeform discussion and later grounding the agent in one or more concrete tickets without restarting from a ticket play button.

## Design

Follow-up to awb-uo30. Add an in-chat ticket context control, likely in AgentRunDetail near the composer/header:
- Provide a searchable/dropdown ticket picker populated from loaded tickets.
- When the user selects a ticket, send an explicit user-visible context message into the current run containing the ticket id, title, file path, status/priority if useful, and body.
- Do not silently mutate context; the transcript should show that ticket context was attached.
- Consider supporting multiple attached tickets, but a single-ticket MVP is acceptable.
- Keep ticket-backed implementation runs unchanged.

## Implementation Notes

Likely touch points:
- Pass the loaded ticket list from `App`/layout props into `AgentsView` or a small ticket-picker component.
- Reuse the existing per-run prompt API (`sendAgentRunPrompt`) if possible; the attach action can format and send a normal visible user message instead of needing hidden context state.
- Suggested visible message format:
  - `Attach ticket context:`
  - `Ticket ID: ...`
  - `Ticket Title: ...`
  - `Ticket File: ...`
  - optional status/priority
  - `Ticket Body:` followed by the full body.
- Disable or guard the picker when the selected run is not active, unless a later implementation supports attaching context to completed historical runs.
- If an attached-ticket list is stored, keep it additive and separate from the original ticket-backed run context.

## Acceptance Criteria

- In an active agent chat, the user can select an existing ticket from a dropdown/search list.
- Selecting a ticket adds that ticket context to the current active agent session without creating a new run.
- The transcript records a visible message that the ticket was attached, including at least id, title, file path, and body.
- The run detail UI indicates attached ticket context, or the transcript makes it clear enough for MVP.
- Works for unticketed runs created by awb-uo30 and does not break ticket-backed runs.
- Add/update Bun tests for the UI/API behavior.

