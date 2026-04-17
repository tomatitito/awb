---
id: tv-z28d
status: closed
deps: []
links: []
created: 2026-04-13T18:12:24Z
type: task
priority: 1
assignee: Jens Kouros
parent: tv-et04
tags: [devx, bun, review]
---
# Make development workflow Bun-native and clean-checkout friendly

package.json currently uses tsx for dev and node for start, while the repo instruction says to always use Bun. The dev command also serves dist/web through src/server.ts, so a fresh checkout needs a prior frontend build and frontend changes do not hot reload.

## Acceptance Criteria

All package scripts use Bun-compatible commands. A fresh checkout can run the development workflow without a preexisting dist/web. Frontend development has a clear hot-reload path or an explicit documented watch/build flow. Production start behavior remains covered by the build output.

