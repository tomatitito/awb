---
id: awb-5jki
status: closed
deps: []
links: [awb-b7cs, awb-34le]
created: 2026-05-11T08:55:33Z
type: feature
priority: 1
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, chat, unticketed, lifecycle, resume, backend]
---
# Model unticketed agent chats as long-lived conversations

Unticketed agent chats should behave like opening pi on the command line: after the assistant answers, the conversation remains open and ready for the next user prompt until the user explicitly quits/archives it.

Implementation notes:
- Introduce explicit lifecycle semantics for conversation-style runs, e.g. waiting/idle after agent_end instead of treating the chat as a completed task.
- Preserve ticket-backed implementation-run semantics: ticket runs may still become completed when the task cycle ends.
- Keep the AgentSession attached for in-memory unticketed chats while they are waiting for user input.
- Add a backend action to explicitly end/archive/quit an unticketed chat without conflating it with aborting the current response.
- Make stale interrupted chats safe when persistence is added later.

## Acceptance Criteria

- After an unticketed assistant response finishes, the chat remains promptable without creating a new run.
- Status/state clearly represents waiting for user input rather than task completion.
- Ticket-backed runs keep their existing completed-task behavior.
- Users/API callers can explicitly quit/archive an unticketed chat.
- Aborting an active response remains distinct from ending the whole chat.
- Tests cover unticketed running -> waiting -> running cycles and explicit quit/archive behavior.


## Notes

**2026-05-11T08:59:05Z**

Decision: use AgentRunStatus `waiting` for unticketed chats after an assistant turn finishes and the chat is ready for user input. Use `close` / closed-chat terminology for the explicit user action that ends an unticketed chat. Closing is distinct from aborting/stopping the current response.

**2026-05-11T09:01:41Z**

Lifecycle decisions to implement: `waiting` applies only to unticketed chats. `close` disposes the live session and keeps history, but closed chats are not permanently terminal; they should be resumable later through the same persisted-session resume path as other agent conversations. If close is requested while running, abort the active response first, then close.
