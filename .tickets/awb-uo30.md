---
id: awb-uo30
status: closed
deps: []
links: []
created: 2026-05-05T05:08:38Z
type: feature
priority: 1
assignee: Jens Kouros
tags: [agent, ui, planning]
---
# Start unticketed agent conversations from Agents view

Users can currently launch agent runs only from a ready ticket play button. Add a way to start an agent from the Agents view without preloading a ticket, so the user can chat with the agent to refine existing tickets or create new tickets.

Current behavior: Graph/Kanban play buttons call createAgentRun(ticketId), which creates a TicketRunContext and starts an implementation-oriented run. The right-side AgentPanel is a legacy/latest-run composer that can create a run only if a selected ticket context exists. The Agents view is the newer multi-run surface for run history/detail.

## Design

Recommended approach:
- Treat this as a new run kind, not as a fake ticket. Extend AgentRunState/TicketRunContext (or introduce AgentRunContext) to support unticketed/planning runs.
- Add an API endpoint/client helper to create an unticketed agent run from the user's first message.
- Do not inject a preconfigured planning prompt or hidden task prompt for this run type. The first user message should be the prompt that starts the session.
- Add a primary button in AgentsView header such as "New agent chat" / "Start agent without ticket". It should open a small composer/modal or inline form for the user's first message, then create/select the new run.
- Update run list/detail UI to display unticketed runs gracefully (title from first prompt or "Unticketed agent chat") and keep existing ticket-backed runs unchanged.
- Keep the existing right-side AgentPanel working, but do not rely on selectedTicket for unticketed starts; consider later deprecating or repurposing it once Agents view handles chat well.

## Implementation Notes

Likely touch points:
- `src/agent/types.ts`: replace the required `run.ticket` shape with a discriminated run context, e.g. ticket-backed vs unticketed chat, or otherwise make ticket context optional without creating fake ticket IDs.
- `src/agent/AgentController.ts`: add a `createUnticketedRun(firstPrompt)` path. It should create the session, append the first user transcript entry, and call `session.prompt(firstPrompt)` directly instead of `buildInitialPrompt(ticket)`.
- Server/API layer and `src/web/agentApi.ts`: add a create-chat endpoint/helper that accepts the user's first message.
- `src/web/workspace.tsx` / `AgentsView`: add the button and first-message composer, then select the created run.
- Existing `createRun(ticket)` and play-button flows should remain ticket-backed and implementation-oriented.

## Acceptance Criteria

- Agents view has a visible button to start an agent without selecting a ticket.
- Starting from that button requires a non-empty user first message, creates an agent session/run, and selects it in the Agents view.
- The user can send follow-up prompts to the unticketed run.
- No preconfigured implementation/planning prompt is injected for unticketed runs; the session starts from the user's first message.
- Ticket-backed play-button runs still work and still use the implementation prompt.
- Unticketed runs render without placeholder/fake ticket IDs in the run list, run detail, transcript, and SSE updates.
- Add/update Bun tests for run creation/context formatting and relevant UI behavior.

## Notes

**2026-05-05T12:45:00Z**

Implemented unticketed agent chats as a first-class run context instead of reusing fake ticket IDs. Added `createUnticketedRun()` in `AgentController`, a new `POST /api/agent/runs/chat` server endpoint and web API helper, and updated the Agents view with a `New agent chat` action plus first-message composer. Ticket-backed play-button runs still use the TDD ticket prompt, while unticketed chats start directly from the user’s first message and render as `Unticketed agent chat` in the run list/detail UI. Verified with `bun run check --max-diagnostics=20`, `bun test`, and `bun run build`.

