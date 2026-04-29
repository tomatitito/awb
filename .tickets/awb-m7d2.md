---
id: awb-m7d2
status: closed
deps: []
links: [tv-nvfy]
created: 2026-04-29T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-c9p4
tags: [code-quality, biome, types, nullability, tests]
---
# Fix core type-safety and nullability diagnostics

Resolve the remaining non-UI Biome diagnostics around explicit `any`, non-null assertions, and a small optional-chain cleanup.

## Current problem files

- `src/agent/createPiSession.ts`
- `src/core/graph.ts`
- `src/server.ts`
- `src/web/main.tsx`
- `tests/agent/LoginController.test.ts`

## Required fixes

### 1. Remove explicit `any` from `createPiSession`

Current issue:
- `model?: Model<any>` triggers `noExplicitAny`

Expected fix:
- replace `any` with the narrowest valid generic type accepted by the pi SDK types
- if the SDK type is intentionally unconstrained, prefer `unknown` or a concrete SDK-provided generic helper type rather than `any`
- keep the existing call sites and behavior unchanged

### 2. Remove non-null assertions from graph traversal code

Current issues:
- `ready.shift()!` in `src/core/graph.ts`
- `queue.shift()!` in `src/core/graph.ts`
- another `ready.shift()!` in topological traversal code

Expected fix:
- rewrite the loops so the shifted value is checked explicitly
- preserve the existing graph semantics and deterministic ordering
- do not change cycle detection behavior or visible-graph behavior
- keep existing graph tests passing

### 3. Remove the optional-chain lint issue in the agent context route

Current issue:
- `if (!ticket || !ticket.ticketId || !ticket.title || !ticket.filePath)`

Expected fix:
- adopt the optional-chain form Biome wants or an equally clear equivalent
- keep the route behavior unchanged for invalid or missing request bodies

### 4. Remove the DOM root non-null assertion

Current issue:
- `document.getElementById('root')!` in `src/web/main.tsx`

Expected fix:
- fail explicitly with a clear error if the root element is missing
- avoid non-null assertions entirely
- keep startup behavior unchanged in normal operation

### 5. Clean up remaining test-only type/nullability issues

Current issues in `tests/agent/LoginController.test.ts`:
- `as any` casts in helper builders
- `loginResolve!()` non-null assertion
- unused `loginResolve` variable in the cancel-flow test

Expected fix:
- replace `as any` with proper partial/mock typing
- use explicit guards or optional invocation instead of non-null assertions
- remove or rename unused test variables appropriately
- keep test intent readable

## Acceptance Criteria

- the listed files no longer produce Biome diagnostics
- graph behavior and login-controller behavior remain covered by tests
- `bun test` passes
- `bun run check` moves closer to green with this ticket alone

## Notes

**2026-04-29T13:10:00Z**

Used red/green TDD against the graph and login-controller tests while fixing the targeted Biome issues. Removed the explicit `any` in `createPiSession` by narrowing to `Model<Api>`, replaced the graph traversal non-null assertions with explicit shifted-value guards, switched the agent context route to the optional-chain form, and made web startup fail clearly when `#root` is missing. Cleaned up the login-controller tests with typed mock helpers and explicit guards instead of `as any` and non-null assertions. Verified the five targeted files with `bunx biome check`, and `bun run check` now drops the remaining warnings/errors to unrelated UI/style diagnostics. `bun test` passes.
