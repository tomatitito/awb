---
id: tv-eq0d
status: closed
deps: [tv-y581, tv-pqg2, tv-u8v3]
links: [tv-u8v3, tv-pqg2, tv-y581]
created: 2026-04-13T09:13:59Z
type: feature
priority: 2
parent: tv-1mg4
tags: [implementation-plan]
---
# Build core ticket loader

Load .tickets/*.md, parse ticket content, and derive the ticket graph data returned to the app.

## Acceptance Criteria

- The loader reads Markdown ticket files from the configured tickets directory.
- The loader returns parsed tickets together with derived application data.
- Loading works against absolute project and tickets paths used by the server.
