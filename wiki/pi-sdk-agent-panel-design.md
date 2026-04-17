# AWB pi SDK agent panel design

## Purpose

Turn `awb-vxxn` into a concrete implementation design using the pi SDK and the pi examples/docs.

This design is based on:

- `docs/sdk.md`
- `docs/extensions.md`
- `docs/rpc.md`
- `examples/sdk/01-minimal.ts`
- `examples/sdk/06-extensions.ts`
- `examples/sdk/11-sessions.ts`
- `examples/sdk/12-full-control.ts`
- `examples/sdk/13-session-runtime.ts`
- `examples/extensions/event-bus.ts`
- `examples/extensions/send-user-message.ts`
- `examples/extensions/plan-mode/*`

## Key decisions

## 1. Use the SDK directly inside the AWB server

Use `@mariozechner/pi-coding-agent` directly in the Node/Bun server process.

Reason:

- `docs/rpc.md` explicitly says Node.js/TypeScript users should prefer `AgentSession` directly instead of spawning a subprocess
- `awb` already has a local Node/Bun server in `src/server.ts`
- a direct SDK integration avoids an extra child-process lifecycle, JSON-RPC framing, and protocol translation layer

So the preferred architecture is:

- browser React UI
- `awb` express server
- pi SDK session hosted in-process on the server

Not the preferred MVP architecture:

- browser React UI
- `awb` express server
- spawned `pi --mode rpc` subprocess

RPC remains a fallback only if direct embedding hits a blocker.

## 2. Start with `createAgentSession()`, not `createAgentSessionRuntime()`

For the first panel milestone, use a single server-owned session created with `createAgentSession()`.

Reason:

- `examples/sdk/01-minimal.ts` and `11-sessions.ts` show that a single session is enough for normal prompting and persistence
- the first `awb` panel does not need `/new`, `/resume`, `/fork`, or session tree navigation yet
- `createAgentSessionRuntime()` is best when the UI needs active session replacement; `examples/sdk/13-session-runtime.ts` shows the added rebinding complexity

Therefore:

- MVP: one long-lived `AgentSession`
- later: move to `AgentSessionRuntime` when AWB adds multi-session management

## 3. Reuse the user’s normal pi auth and model config, but keep AWB sessions separate

Use:

- default `AuthStorage.create()`
- default `ModelRegistry.create(authStorage)`
- default pi settings/model discovery

This lets `awb` reuse the user’s existing pi login/API key setup.

But do **not** mix AWB panel sessions with the user’s general pi session history.

Use a dedicated AWB session directory, for example:

- `<projectDir>/.awb/pi-sessions/`

This keeps the embedded panel state:

- project-local
- easier to inspect/debug
- isolated from terminal pi usage

## 4. Keep resource discovery project-aware

Use `DefaultResourceLoader` with `cwd = projectDir`.

That allows pi to discover, per `docs/sdk.md`:

- project-local `.pi/extensions/`
- project-local `.pi/prompts/`
- project-local skills
- `AGENTS.md` files walking up from the project

This matters because AWB may later want to ship or support:

- project-local Ralph-style pi extensions
- project-specific ticket workflows
- project-specific agent instructions

## 5. Treat pi as a server-side state machine and stream events to the browser

Do not expose raw SDK objects to the browser.

Instead:

- subscribe to pi session events on the server
- map them into AWB-specific serializable events
- send those to the browser over SSE

This fits the current app well because `src/server.ts` already uses SSE for ticket live reload.

## Recommended architecture

## Server-side modules

Suggested new files:

- `src/agent/types.ts`
- `src/agent/createPiSession.ts`
- `src/agent/AgentController.ts`
- `src/agent/eventMapping.ts`

### `src/agent/types.ts`

Define the web-safe state and event types.

Suggested types:

- `AgentPanelState`
- `AgentPanelStatus`
- `AgentPanelEvent`
- `PromptRequest`
- `SelectedTicketContext`

Example shape:

```ts
export type AgentPanelStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'running'
  | 'error'

export type AgentPanelState = {
  status: AgentPanelStatus
  sessionId?: string
  sessionFile?: string
  model?: {
    provider: string
    id: string
  }
  selectedTicketId?: string
  lastError?: string
  isStreaming: boolean
  queuedSteeringCount: number
  queuedFollowUpCount: number
}
```

### `src/agent/createPiSession.ts`

Create the SDK session and its dependencies.

Recommended implementation choices:

- `AuthStorage.create()`
- `ModelRegistry.create(authStorage)`
- `DefaultResourceLoader({ cwd: projectDir, eventBus })`
- `SessionManager.continueRecent(projectDir, awbSessionDir)` or equivalent dedicated session path

Important note from `docs/sdk.md`:

- if explicit tools are supplied together with a custom `cwd`, use tool factories like `createCodingTools(projectDir)`
- for MVP, it is fine to let pi create its default coding tools automatically

Recommended initial factory:

```ts
const authStorage = AuthStorage.create()
const modelRegistry = ModelRegistry.create(authStorage)
const eventBus = createEventBus()

const resourceLoader = new DefaultResourceLoader({
  cwd: projectDir,
  eventBus,
})
await resourceLoader.reload()

const { session } = await createAgentSession({
  cwd: projectDir,
  authStorage,
  modelRegistry,
  resourceLoader,
  sessionManager: SessionManager.continueRecent(projectDir, awbSessionDir),
})
```

### `src/agent/AgentController.ts`

Own the embedded pi session for the lifetime of the AWB server.

Responsibilities:

- lazy-create the session on first use or eagerly on server startup
- expose current serializable panel state
- subscribe to SDK events and update state
- broadcast mapped events to connected browser clients
- accept browser actions like prompt/abort
- store selected-ticket context for prompt seeding

Suggested class shape:

```ts
class AgentController {
  getState(): AgentPanelState
  subscribe(listener: (event: AgentPanelEvent) => void): () => void
  ensureStarted(): Promise<void>
  setSelectedTicket(ticket: SelectedTicketContext | undefined): void
  prompt(text: string): Promise<void>
  steer(text: string): Promise<void>
  followUp(text: string): Promise<void>
  abort(): Promise<void>
  dispose(): Promise<void>
}
```

### `src/agent/eventMapping.ts`

Translate pi SDK events into a smaller browser contract.

Map at least these SDK events from `docs/sdk.md`:

- `agent_start`
- `agent_end`
- `message_update`
- `message_end`
- `tool_execution_start`
- `tool_execution_end`
- `queue_update`

Suggested browser events:

- `agent-state`
- `assistant-text-delta`
- `assistant-message-complete`
- `tool-start`
- `tool-end`
- `queue-update`
- `error`

## HTTP/SSE API design

The current server already exposes:

- `GET /api/tickets`
- `GET /api/events`

Add a second SSE stream dedicated to the agent panel.

## Endpoints

### `GET /api/agent/state`

Returns the latest serialized panel state.

Example response:

```json
{
  "status": "ready",
  "sessionId": "...",
  "sessionFile": "/path/to/.awb/pi-sessions/...jsonl",
  "isStreaming": false,
  "queuedSteeringCount": 0,
  "queuedFollowUpCount": 0,
  "selectedTicketId": "awb-kg0z"
}
```

### `GET /api/agent/events`

SSE stream for incremental agent updates.

Example event names:

- `ready`
- `agent-state`
- `assistant-text-delta`
- `assistant-message-complete`
- `tool-start`
- `tool-end`
- `queue-update`
- `error`

### `POST /api/agent/prompt`

Body:

```json
{
  "text": "Implement the selected ticket"
}
```

Behavior:

- calls `session.prompt(text)` when idle
- if streaming, either reject or require explicit mode later

For MVP, reject while streaming and add steer/follow-up buttons later.

### `POST /api/agent/abort`

Calls `session.abort()`.

### `POST /api/agent/context`

Updates server-side selected-ticket context.

Body:

```json
{
  "ticketId": "awb-kg0z",
  "title": "Add agent panel layout and toggle controls",
  "body": "...",
  "filePath": ".tickets/awb-kg0z.md"
}
```

This endpoint does **not** trigger a prompt by itself.

It just keeps server-side context synchronized with the browser selection.

## Front-end design

Suggested new files:

- `src/web/AgentPanel.tsx`
- `src/web/agentApi.ts`
- `src/web/useAgentPanel.ts`

## `useAgentPanel()` hook

Responsibilities:

- fetch initial state from `GET /api/agent/state`
- subscribe to `GET /api/agent/events`
- keep local UI state synchronized
- expose actions for prompt/abort/context updates

Suggested return shape:

```ts
{
  state,
  transcript,
  toolActivity,
  sendPrompt,
  abort,
  setSelectedTicketContext,
}
```

## `AgentPanel` component

Suggested MVP sections:

1. header
   - title
   - close button
   - status badge
2. selected ticket context
   - ticket id
   - title
3. transcript area
   - assistant output
   - tool activity summary
4. composer
   - textarea/input
   - send button
   - abort button

### First transcript model

Keep the first transcript deliberately simple.

Store:

- incremental assistant text
- coarse tool execution records
- error messages

Do **not** attempt to reproduce pi’s full terminal rendering in the web UI yet.

## Prompt construction design

The first prompt flow should be explicit and simple.

When the user clicks send:

1. browser sends plain text to `POST /api/agent/prompt`
2. server checks whether there is selected-ticket context
3. if yes, server prepends a stable context block
4. server calls `session.prompt(fullPrompt)`

Recommended initial context envelope:

```text
You are working inside AWB.

Selected ticket:
- id: awb-kg0z
- title: Add agent panel layout and toggle controls
- file: .tickets/awb-kg0z.md

Ticket body:
...

User request:
<user text>
```

Why do it this way first:

- simple to reason about
- easy to inspect in logs/sessions
- does not require custom pi extensions yet

Later, this can move into:

- a prompt template
- a project-local extension
- a richer context assembler

## Session lifecycle design

## Initial behavior

- create one session for the AWB server/project
- continue the most recent AWB-owned panel session if it exists
- otherwise create a new one
- keep that session alive until the server shuts down

This follows the pattern shown in `examples/sdk/11-sessions.ts`.

## Future behavior

When AWB later adds:

- new session
- resume session
- fork session
- tree navigation

then migrate the controller to `createAgentSessionRuntime()` as shown in `examples/sdk/13-session-runtime.ts`.

Important runtime note from the docs/example:

- when runtime replaces the active session, re-subscribe to the new session
- if extensions are used at runtime replacement boundaries, re-bind them for the new session

## Extension strategy

The embedded panel should support project-local pi extensions from the start, even if AWB itself ships none initially.

Why:

- `docs/extensions.md` and `examples/sdk/06-extensions.ts` show that extensions are the correct way to add commands, custom tools, and lifecycle hooks
- your earlier Ralph-loop direction already points toward project-local pi extensions

So the design should allow this progression:

### MVP

- no required custom extension
- just use discovered extensions if present

### Next step

- add a project-local `.pi/extensions/awb-ticket-workflow.ts`
- use that extension to expose ticket-aware commands or custom tools

### Later

- use the extension event bus to coordinate AWB and pi-specific workflow state

## Event bus recommendation

Create and pass a shared event bus to the `DefaultResourceLoader`.

Reason:

- `docs/sdk.md` and `examples/extensions/event-bus.ts` show the event bus is the cleanest bridge between host code and extensions

Practical AWB use later:

- AWB server receives selected ticket change from browser
- AWB server emits `awb:selected-ticket` on the event bus
- project-local pi extension can react without browser-specific coupling

This is not required for the first working panel, but it is worth wiring in early because it is low-cost.

## Error handling and degraded mode

The panel must stay usable when pi is unavailable.

## Initialization failure cases

Examples:

- no pi auth configured
- no available model
- resource loader failure
- session creation failure

Behavior:

- keep panel visible
- show `status: error`
- render actionable message
- do not crash the whole AWB server UI

## Prompt failure cases

Examples:

- provider error
- auth expired
- model unavailable
- tool failure

Behavior:

- surface error event in transcript/status area
- keep prior transcript visible
- allow retry

## Why not use extension UI/TUI in AWB?

The docs/examples show rich TUI customization and RPC extension UI flows.

Those are useful references, but not the right rendering target for AWB because:

- AWB is a web UI, not a terminal TUI
- the panel should render native React components
- replicating pi’s terminal UI semantics in the browser is unnecessary for MVP

So AWB should consume:

- session state
- text deltas
- tool lifecycle events

and render its own web-native panel.

## Concrete MVP implementation order

1. Add `@mariozechner/pi-coding-agent` to `package.json`.
2. Implement `src/agent/createPiSession.ts`.
3. Implement `src/agent/AgentController.ts` with one persistent session.
4. Add express routes:
   - `GET /api/agent/state`
   - `GET /api/agent/events`
   - `POST /api/agent/prompt`
   - `POST /api/agent/abort`
   - `POST /api/agent/context`
5. Build `src/web/useAgentPanel.ts`.
6. Update `AgentPanel` from placeholder to live state.
7. Seed prompt context from selected ticket.
8. Add documentation for auth/model expectations.

## Follow-up design after MVP

Once the basic panel works, the next concrete upgrades should be:

- add steer/follow-up actions using `session.steer()` and `session.followUp()`
- expose session metadata in the panel
- add "new panel session" and migrate to `AgentSessionRuntime`
- add project-local AWB pi extension for ticket commands
- emit ticket selection over the shared event bus
- experiment with a Glimpse-based external companion for status only

## Final recommendation

For `awb-vxxn`, implement:

- **direct SDK embedding inside `src/server.ts`-adjacent server code**
- **one persistent `createAgentSession()`-based controller**
- **SSE from server to browser for transcript/state updates**
- **project-aware `DefaultResourceLoader` so `.pi/extensions/` works later**
- **separate AWB-owned session storage under the project**

That is the smallest design that is:

- aligned with pi’s own docs/examples
- compatible with AWB’s current server/web architecture
- ready for later extension-based ticket workflows
- simpler than RPC subprocess orchestration
