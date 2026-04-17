---
id: tv-0y0u
status: closed
deps: [tv-eq0d]
links: []
created: 2026-04-13T09:13:59Z
type: feature
priority: 2
parent: tv-1mg4
tags: [implementation-plan]
---
# Serve ticket data and frontend assets from a local web server

Start a local server that exposes /api/tickets and serves the built frontend assets.

## Acceptance Criteria

- A local server serves ticket data from /api/tickets.
- Built frontend assets are served from dist/web.
- Unknown routes fall back to index.html so the browser app loads correctly.
