---
id: tv-vags
status: open
deps: []
links: []
created: 2026-04-13T18:12:47Z
type: task
priority: 2
assignee: Jens Kouros
parent: tv-et04
tags: [performance, bundle, review]
---
# Split graph and markdown code out of the initial web bundle

The production build emits a 721 kB minified JS chunk and Vite warns about chunk size. Cytoscape and ReactMarkdown are imported by the main App entry, so every tab pays for graph and markdown support up front.

## Acceptance Criteria

Graph/Cytoscape code is lazy-loaded when the graph view is needed. Markdown/details-specific heavy code is split where practical. bun run build no longer emits the current oversized initial chunk warning or the initial chunk size is substantially reduced and documented. Loading states remain acceptable while lazy chunks load.

