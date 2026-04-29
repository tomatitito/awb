# awb

Agentic workbench built from the `tk-viewer` codebase.

This repository currently reuses the ticket browsing UI and local server from `tk-viewer` as the foundation for `awb`.
The current app already provides:

- a local CLI executable: `awb`
- parsing of `tk`-style `.tickets/*.md`
- browser views for Graph, Kanban, and Details
- a toggleable pi-powered agent panel
- live reload when ticket files change

The intended next step for `awb` is to add an agent panel and execution flow so the workbench can not only view tickets, but also implement and work on them.

## Development

```bash
bun install
bun run dev
```

## Build

```bash
bun run build
```

## Run

Inside any project with a `.tickets/` directory:

```bash
awb
```

Or point at another project:

```bash
awb --dir /path/to/project
```

## Options

```bash
awb --dir /path/to/project
awb --tickets-dir .tickets
awb --port 4312
awb --no-open
awb --dev
awb --editor "code -n"
awb check-for-updates
awb self-update
```

## Current UI

- **Graph**: dependency-oriented ticket graph
- **Kanban**: tickets grouped by status
- **Details**: full ticket metadata and markdown body
- **Agent panel**: server-embedded pi SDK session with SSE-driven transcript and tool activity

## Configuration

AWB reads optional project config from `<project>/.awb/config.json`.

Example:

```json
{
  "editor": "code -n",
  "agentRuns": {
    "worktreeIsolation": true
  }
}
```

Editor command precedence is:

1. `--editor`
2. `AWB_EDITOR`
3. `.awb/config.json`

When worktree isolation is enabled, background agent runs use dedicated git worktrees under `.awb/worktrees/<run-id>` and the Agents UI can open retained worktrees in the configured editor.

## Agent panel requirements

The agent panel embeds `@mariozechner/pi-coding-agent` directly in the awb server process.

Operational assumptions:

- pi authentication and model configuration come from the user's normal pi setup
- if no pi auth or no usable model is configured, the panel stays visible and reports the initialization error
- panel sessions are stored separately from normal pi terminal sessions under `<project>/.awb/pi-sessions/`
- project-local pi discovery still applies via the project cwd, including `.pi/extensions/`, `.pi/prompts/`, skills, and `AGENTS.md`

The browser only receives serialized agent state and incremental SSE events. It does not access raw pi SDK objects directly.

Implementation notes:

- `src/agent/createPiSession.ts` creates one embedded pi session using the project directory as `cwd`
- `src/agent/AgentController.ts` owns panel state, selected-ticket context, prompt submission, aborts, and pi event mapping
- `src/server.ts` exposes `/api/agent/state`, `/api/agent/events`, `/api/agent/context`, `/api/agent/prompt`, and `/api/agent/abort`
- `src/web/useAgentPanel.ts` keeps the React state in sync over SSE and incremental event updates
- `src/web/AgentPanel.tsx` renders the context summary, transcript, tool activity, and prompt composer

See [`wiki/agent-panel-architecture.md`](./wiki/agent-panel-architecture.md) for the detailed architecture and follow-up workflow roadmap.

## Ticket format

`awb` expects Markdown files in `.tickets/` with frontmatter like:

```md
---
id: mar-1234
status: open
deps: [mar-0001]
links: [mar-0002]
priority: 2
tags: [architecture, tooling]
---
# Ticket title

Ticket body here.
```

## Mobile regression hooks

AWB exposes stable `data-awb` selectors so mobile regression flows can target responsive Graph, Details, and Agent interactions without depending on CSS classes.

Current mobile-focused selectors include:

- `data-awb="mobile-agent-toggle"`
- `data-awb="tab-graph"`
- `data-awb="tab-kanban"`
- `data-awb="tab-details"`
- `data-awb="graph-ticket-card"` with `data-ticket-id="<ticket-id>"`
- `data-awb="details-view"` with `data-selected-ticket-id="<ticket-id>"`
- `data-awb="agent-overlay"`
- `data-awb="agent-overlay-close"`
- `data-awb="agent-panel"` with `data-agent-status` and `data-agent-streaming`
- `data-awb="agent-send"`, `data-awb="agent-stop"`, and `data-awb="agent-pause"`

The current automated mobile regression coverage uses Bun tests for the mobile navigation flow semantics in `tests/web/mobileFlow.test.ts`. A Maestro flow can be layered on top of these selectors later without changing the UI contracts.

## Notes

- This repo was bootstrapped by copying over the non-generated contents of `../tk-viewer`.
- `node_modules/` and `dist/` are intentionally not copied.
- Several project references were renamed from `tk-viewer` to `awb`.
