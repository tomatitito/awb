# AWB agent panel architecture

Related tickets:

- `awb-7vzs` — epic: Build the awb agent panel
- `awb-vqm7` — Document agent panel architecture and follow-up workflow work

See also:

- [AWB agent panel implementation plan](./agent-panel-implementation-plan.md)
- [AWB pi SDK agent panel design](./pi-sdk-agent-panel-design.md)

## Goal

Document the architecture that shipped for the first AWB agent panel milestone, explain why the pi SDK was embedded directly, and capture the next workflow capabilities that are intentionally still out of scope.

## What shipped

The first milestone adds a toggleable right-side agent panel to the AWB UI and wires it to a single embedded pi session.

The shipped panel can:

- open alongside the existing Graph, Kanban, and Details views
- show connection and run status
- show the current model and session id
- send the currently selected ticket to the server as prompt context
- stream assistant transcript updates into the browser
- show recent tool activity
- abort an in-flight run

The shipped panel does **not** yet implement a higher-level ticket workflow loop. It is a thin interactive shell around an embedded pi coding session.

## Why the pi SDK was chosen

AWB already has a long-lived local Bun/Express server. Embedding the pi SDK directly inside that server keeps the first integration simple:

- no subprocess lifecycle management
- no JSON-RPC bridge to maintain
- no extra protocol translation beyond the browser-safe event mapping AWB already needs
- direct access to pi session APIs for prompting, aborting, and subscribing to events
- project-aware resource loading using the same working directory as the rest of AWB

This follows the direction from the pi SDK docs and keeps the architecture aligned with AWB's current shape:

- browser UI for presentation
- AWB server for orchestration
- pi SDK for agent execution

## High-level architecture

```text
React UI
  ├─ src/web/App.tsx
  ├─ src/web/AgentPanel.tsx
  └─ src/web/useAgentPanel.ts
          │ HTTP + SSE
          ▼
AWB server
  ├─ src/server.ts
  └─ src/agent/AgentController.ts
          │ pi SDK events + commands
          ▼
Embedded pi session
  └─ src/agent/createPiSession.ts
```

The browser never touches raw pi SDK objects. AWB keeps the pi runtime fully server-side and exposes only serialized state and events.

## Server-side architecture

### `src/agent/createPiSession.ts`

This module constructs the embedded pi session.

Key choices:

- uses `AuthStorage.create()` and `ModelRegistry.create(...)` so AWB reuses the user's normal pi auth and model configuration
- uses `DefaultResourceLoader({ cwd: projectDir, eventBus })` so pi can discover project-local `.pi/` resources and `AGENTS.md`
- creates a dedicated session directory at `<projectDir>/.awb/pi-sessions/`
- uses `SessionManager.continueRecent(projectDir, awbSessionDir)` so the panel resumes the most recent AWB-owned session for that project

This separation is important: AWB benefits from the user's existing pi setup without mixing its in-app sessions into the user's terminal history.

### Session storage format and repository hygiene

The AWB-owned session directory contains runtime-generated pi session logs.

Current location:

- `<projectDir>/.awb/pi-sessions/`

Current format:

- one `.jsonl` file per session
- session metadata such as session id, timestamp, cwd, and chosen model
- full user messages as AWB sent them to pi, including selected-ticket context that was prepended to the prompt
- assistant responses
- provider usage/cost metadata
- provider-specific payload details that may include stored reasoning/thinking artifacts

This is useful for future work because it gives AWB a durable local record of what happened in a panel run. It could later support:

- transcript history across reloads
- session resume/browse UI
- debugging run-state bugs
- richer observability around prompts, outputs, and usage

It also means the directory can contain sensitive project context and should be treated as local runtime state rather than source-controlled project data.

For that reason, `.awb/` is ignored in `.gitignore`.

### `src/agent/AgentController.ts`

`AgentController` is the server-side state machine for the panel.

Responsibilities:

- lazily start the pi session on first agent API access
- track a browser-safe `AgentPanelState`
- subscribe to pi session events
- map pi events into AWB panel events
- retain the selected ticket context
- build the final prompt sent to pi
- forward abort requests
- broadcast state changes to connected browsers via `src/server.ts`

Current state model:

- `idle`
- `connecting`
- `ready`
- `running`
- `error`

Current derived metadata:

- `sessionId`
- `sessionFile`
- `model`
- `selectedTicketId`
- `lastError`
- `isStreaming`
- `queuedSteeringCount`
- `queuedFollowUpCount`

### Prompt shaping

Prompt construction is intentionally thin in the first milestone.

When a ticket is selected, `AgentController.buildPrompt()` prepends:

- AWB framing text
- selected ticket id
- selected ticket title
- ticket file path
- ticket body
- the user request entered in the panel

That means ticket awareness exists today, but only as a simple prompt preamble. There is not yet a richer workflow engine, structured ticket schema injection, or task-specific prompting strategy.

### Event mapping

The controller currently maps these important pi session events into browser events:

- `agent_start` → running state
- `agent_end` → ready/error state
- `queue_update` → queue counts
- `message_update` text deltas → streamed assistant transcript chunks
- `message_end` for assistant messages → final transcript entry and terminal message errors
- `tool_execution_start` / `tool_execution_end` → tool activity items

Ignored events such as compaction, turn boundaries, and tool execution updates can be surfaced later if the UI needs them.

## HTTP and SSE surface

`src/server.ts` exposes a narrow API for the panel:

- `GET /api/agent/state` — ensure the session exists and return the current panel state
- `GET /api/agent/events` — open an SSE stream for incremental panel events
- `POST /api/agent/context` — set or clear the selected ticket context
- `POST /api/agent/prompt` — submit a new user request
- `POST /api/agent/abort` — abort the active run

This keeps the browser API stable even if the underlying pi integration changes later.

## Browser architecture

### `src/web/useAgentPanel.ts`

This hook is the browser-side adapter.

Responsibilities:

- fetch the initial agent state
- subscribe to `/api/agent/events`
- maintain React state for panel status, transcript, and tool activity
- apply incremental transcript deltas
- expose imperative actions for prompt submission, abort, and selected-ticket updates

The hook deliberately owns the event-to-UI mapping so the component tree stays simple.

### `src/web/AgentPanel.tsx`

This is the presentation layer.

It renders:

- header and status badge
- model/session/queue summary
- selected ticket context
- transcript list
- recent tool activity
- prompt composer with send and abort actions

The component does not know about pi SDK internals. It only renders the serializable state delivered by the hook.

## Current data flow

### Session startup

1. The browser loads the app.
2. `useAgentPanel()` requests `GET /api/agent/state`.
3. The server calls `agentController.ensureStarted()`.
4. `createPiSession()` constructs or resumes the AWB-owned pi session.
5. The browser receives initial state and then subscribes to `/api/agent/events`.

### Ticket selection

1. The user selects a ticket in the main AWB UI.
2. The browser posts that ticket's minimal context to `POST /api/agent/context`.
3. `AgentController` stores the ticket metadata for later prompt construction.
4. The selected ticket id is reflected back through panel state.

### Prompt execution

1. The user submits text from the panel composer.
2. The browser posts to `POST /api/agent/prompt`.
3. `AgentController` ensures there is an active session and rejects concurrent runs.
4. The controller prepends selected-ticket context if available.
5. The pi session runs and emits streaming events.
6. `src/server.ts` rebroadcasts mapped events over SSE.
7. `useAgentPanel()` updates transcript, tool activity, and state incrementally.

## Error handling and degradation

The first milestone intentionally degrades gracefully.

If pi cannot start because auth, model configuration, or other initialization is missing:

- the panel still renders
- the server reports an error state instead of crashing the app
- the browser shows the error in the panel UI

If the browser loses the SSE stream:

- the panel shows an event-stream connection error unless a run is already marked as active

If the user tries to send a prompt during an active run:

- the server returns a conflict error and the panel surfaces it inline

## Current limitations

The current architecture is intentionally conservative.

Not implemented yet:

- explicit multi-session management inside AWB
- resumable session browsing or forking from the UI, even though the underlying `.awb/pi-sessions/*.jsonl` files already exist
- structured prompt templates per ticket type
- slash commands or steering/follow-up controls in the panel
- ticket status transitions triggered by agent progress
- background job execution detached from the open browser tab
- durable transcript/tool history rendering across page reloads
- richer visualization of tool progress, diffs, or file changes
- approval checkpoints for risky actions

## Follow-up workflow roadmap

The next layer of value should come from workflow features built on top of the current thin session adapter.

### 1. Richer ticket-aware prompting

Possible additions:

- prompt templates keyed by ticket type, priority, or tags
- structured inclusion of dependencies, links, and acceptance criteria
- explicit repository context such as open child tickets or parent epic information
- per-project prompt fragments from `.pi/prompts/` or AWB-managed templates

### 2. Ticket execution workflows

Possible additions:

- one-click "implement selected ticket"
- guided loops such as inspect → plan → implement → test → summarize
- optional "set ticket to in progress" / "close ticket" actions tied to run milestones
- ticket completion summaries written back to the ticket or attached as notes

### 3. Better observability

Possible additions:

- show commentary and tool streaming updates separately
- display edited files and diff previews
- preserve transcript history between page reloads
- expose session file paths and resume actions in the UI

### 4. Automation hooks

Possible additions:

- preflight checks before runs
- post-run lint/test/build hooks
- repository-specific workflow extensions discovered via `.pi/extensions/`
- agent-generated notes or changelog entries written back into AWB artifacts

### 5. Multi-session and background work

Possible additions:

- multiple agent tabs or named sessions
- queued runs per ticket
- a background worker model with reconnectable progress streams
- detached status surfaces such as a Glimpse companion or menu-bar helper

## Recommended boundary to preserve

As follow-up work lands, AWB should keep this architectural boundary intact:

- pi stays server-side
- the browser only consumes serialized state/events
- workflow orchestration lives above the raw pi session layer

That separation is what makes the current implementation easy to reason about and gives AWB room to evolve beyond a single prompt box without rewriting the core integration.
