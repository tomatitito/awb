# awb

Agentic workbench built from the `tk-viewer` codebase.

This repository currently reuses the ticket browsing UI and local server from `tk-viewer` as the foundation for `awb`.
The current app already provides:

- a local CLI executable: `awb`
- parsing of `tk`-style `.tickets/*.md`
- browser views for Graph, Kanban, and Details
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
```

## Current UI

- **Graph**: dependency-oriented ticket graph
- **Kanban**: tickets grouped by status
- **Details**: full ticket metadata and markdown body

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

## Notes

- This repo was bootstrapped by copying over the non-generated contents of `../tk-viewer`.
- `node_modules/` and `dist/` are intentionally not copied.
- Several project references were renamed from `tk-viewer` to `awb`.
