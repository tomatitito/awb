---
id: awb-ecc1
status: open
deps: [awb-5jki]
links: []
created: 2026-05-11T08:55:33Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, chat, unticketed, lifecycle, ui]
---
# Expose command-line-like unticketed chat controls in the Agents UI

Update the Agents UI so unticketed chats feel like a persistent command-line agent session. The composer should stay available whenever the chat is waiting for user input, and quitting the chat should be an explicit user action.

This ticket is UI-focused and depends on backend lifecycle/status support for long-lived unticketed conversations.

## Acceptance Criteria

- Unticketed chats show a ready/waiting state after the assistant finishes answering.
- The follow-up composer remains enabled while the chat is waiting.
- UI copy distinguishes Stop current response from Quit/Archive chat.
- Quit/Archive is available for unticketed chats and updates the list/detail state.
- Ticket-backed completed runs keep their continue/resume copy instead of being presented as indefinite chats.
- Desktop and mobile Agents layouts expose equivalent controls.


## Notes

**2026-05-11T08:59:05Z**

Decision: UI copy should use `waiting` for idle unticketed chats and `Close chat` for the explicit end-chat action. `Stop` remains reserved for aborting the current active response.

**2026-05-11T09:01:41Z**

UI lifecycle decisions: `Close chat` should keep history and indicate the chat can be resumed later, not deleted. Closing while running should be allowed and should communicate that the active response will be stopped before closing. No delete affordance in this epic.
