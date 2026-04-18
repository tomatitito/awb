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

The original bundle-size review referenced Cytoscape, but the broader issue still applies: graph UI code and markdown/details rendering should not all be loaded up front when users first open the app. The initial web bundle should stay focused on the default shell and defer heavier tab-specific code until it is actually needed.

## Acceptance Criteria

- Graph-related UI code is lazy-loaded when Graph mode is first opened, where practical.
- Markdown/details-specific heavy code is split out of the initial bundle where practical.
- `bun run build` no longer emits the current oversized initial chunk warning, or the remaining bundle tradeoff is substantially improved and documented.
- Loading states remain acceptable while lazy chunks load.

