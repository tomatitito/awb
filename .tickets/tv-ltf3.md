---
id: tv-ltf3
status: closed
deps: []
links: []
created: 2026-04-14T10:11:15Z
type: task
priority: 3
assignee: Jens Kouros
parent: tv-cdsg
tags: [ui, graph, polish]
---
# Move ready badge beside status badge in graph cards

In Graph mode, the ready badge currently renders in the bottom-right metadata row. On compact cards this competes with the title area and can cause titles to be cut off more aggressively than intended. Move the ready badge into the top row so it appears to the right of the status badge. The goal is to keep both badges together at the top and free more vertical space for the two-line title.

## Acceptance Criteria

- In Graph mode, ready badges no longer appear in the bottom metadata row of ticket cards.
- Ready badges render in the top row beside the status badge.
- Status and ready badges appear adjacent to each other on the right side of the card header.
- Moving the ready badge preserves or improves title readability by freeing vertical space for the title area.
- The card remains compact and readable for tickets that are both open and ready.

