---
id: awb-vxxn
status: closed
deps: [awb-kg0z]
links: []
created: 2026-04-16T21:33:20Z
type: feature
priority: 1
parent: awb-7vzs
tags: [agent, panel, pi-sdk, integration]
---
# Integrate the pi SDK into the agent panel

Integrate the awb agent panel with the pi SDK using a direct server-side embedding approach. The first version should host pi inside the awb server process, stream serialized agent state and events to the browser, and keep the browser UI decoupled from raw pi SDK objects.

## Design

Follow the concrete design in `wiki/pi-sdk-agent-panel-design.md`.

For the MVP:

- embed `@mariozechner/pi-coding-agent` directly in the awb server instead of spawning `pi --mode rpc`
- use a single persistent `createAgentSession()`-based controller rather than `createAgentSessionRuntime()`
- keep pi session ownership on the server and expose only serialized state/events to the browser
- use a project-aware `DefaultResourceLoader({ cwd: projectDir })` so project-local `.pi/extensions/` and `AGENTS.md` discovery continue to work
- keep awb-owned panel sessions separate from normal pi terminal sessions
- use SSE to stream incremental agent updates to the web UI

Document RPC mode only as a fallback if direct SDK embedding proves insufficient.

## Acceptance Criteria

- The pi SDK is embedded directly in the awb server process via `@mariozechner/pi-coding-agent`.
- The first implementation uses a single persistent server-owned `createAgentSession()`-based controller.
- The server exposes agent state and incremental agent event streaming endpoints for the web UI.
- The browser agent panel consumes serialized state/events and does not depend on raw pi SDK objects.
- Selected ticket context can be supplied to the server-side prompt path for agent requests.
- Agent session persistence is isolated from normal pi terminal sessions used outside awb.
- The integration keeps project-local pi resource discovery available for future `.pi/extensions/`, prompts, skills, and `AGENTS.md` context.
- The panel degrades gracefully when pi authentication, model selection, or session initialization fails.
- Required configuration and operating assumptions for the pi-powered panel are documented in the repo.

