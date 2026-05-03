---
id: awb-4m8h
status: closed
deps: []
links: []
created: 2026-05-03T10:33:36Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-3h1d
tags: [release, packaging, web, build, binary]
---
# Embed built frontend assets into the compiled AWB binary

Update the build/release process so the production frontend assets from dist/web are embedded into the compiled AWB binary instead of being expected as sidecar files on disk. The current compiled install can serve API routes but cannot serve / because the release artifact does not carry dist/web in a location the runtime can resolve. Prefer an explicit embedded asset manifest/module over runtime filesystem assumptions.

## Acceptance Criteria

The release build generates and compiles an embedded representation of dist/web into the AWB binary. Production/static serving no longer depends on dist/web existing next to the executable. The compiled awb binary serves /index.html and the referenced hashed JS/CSS assets successfully. --dev behavior continues to use the existing Vite middleware workflow.

