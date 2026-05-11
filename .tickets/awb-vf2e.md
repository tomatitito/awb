---
id: awb-vf2e
status: closed
deps: []
links: []
created: 2026-05-11T08:51:52Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-3h5e
tags: [agent, runs, resume, design, persistence]
---
# Design durable agent conversation resume storage

Define the storage and resume contract before implementing cross-restart conversation resume.

Questions to answer:
- What AWB run metadata must be persisted separately from pi session files?
- Should storage be one JSON file or one file per run under .awb/?
- How are partial writes handled safely?
- How are missing/stale pi session files represented?
- How does worktree state interact with resumed runs?
- Which SessionManager or pi SDK API can reopen a specific session file rather than merely continue the most recent session?

## Acceptance Criteria

- A short design note is added under wiki/ or directly to the epic as a tk note.
- The note specifies file format, migration/default behavior, and error states.
- The note identifies the pi SDK API needed to reopen a specific session.
- Follow-up implementation tickets are updated if the design changes their scope.

