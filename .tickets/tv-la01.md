---
id: tv-la01
status: closed
deps: [tv-fvrl, tv-uqq6, tv-y2q8, tv-qvj3]
links: [tv-7t4f, tv-fvrl, tv-qxzv, tv-uqq6, tv-s2iy]
created: 2026-04-13T09:13:59Z
type: chore
priority: 2
parent: tv-1mg4
tags: [implementation-plan]
---
# Align source tree with the planned component/lib structure

Refactor the frontend into smaller component and helper modules where it improves maintainability and aligns better with the original plan.

## Acceptance Criteria

- Frontend code is split into smaller component and helper modules where that improves maintainability.
- The resulting structure still matches the current behavior and build output.
- The refactor keeps shared concerns such as tab state, filtering, and presentation boundaries clear.
