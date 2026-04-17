---
id: tv-pqg2
status: closed
deps: [tv-y581]
links: [tv-eq0d, tv-u8v3, tv-y581]
created: 2026-04-13T09:13:59Z
type: task
priority: 2
parent: tv-1mg4
tags: [implementation-plan]
---
# Parse tk markdown tickets with tolerant defaults

Parse YAML frontmatter, infer title from the first heading, keep the Markdown body, and apply tolerant defaults for missing fields.

## Acceptance Criteria

- Ticket parsing reads YAML frontmatter and Markdown body content.
- The first Markdown heading is used as the title when present.
- Missing id, title, deps, links, and tags fall back to the documented defaults.
