---
id: awb-j4x6
status: open
deps: []
links: [tv-nvfy]
created: 2026-04-29T00:00:00Z
type: task
priority: 1
assignee: Jens Kouros
parent: awb-c9p4
tags: [code-quality, biome, react, a11y, ui]
---
# Fix React hook and accessibility diagnostics in the web UI

Resolve the remaining Biome diagnostics in the React UI around hook dependencies, React keys, semantic elements, and invalid ARIA usage.

## Current problem files

- `src/web/AgentLoginSection.tsx`
- `src/web/AgentPanel.tsx`
- `src/web/workspace.tsx`

## Required fixes

### 1. Fix the polling effect dependencies in `AgentLoginSection`

Current issues:
- the effect captures `loginFlow` but depends on `loginFlow?.status`
- Biome reports missing/excessively specific dependencies

Expected fix:
- rewrite the effect dependency list so it matches the actual captured values
- preserve the current polling behavior for `authorizing`, `awaiting-input`, and `running`
- avoid reintroducing overlapping requests or stale-closure behavior
- keep the earlier login-flow reliability fix intact

### 2. Remove array-index keys from progress message rendering

Current issue:
- `key={`${message}-${index}`}` uses the array index

Expected fix:
- provide a stable key strategy that does not rely on the array index
- if messages are not uniquely identifiable today, adjust the data shape or rendering strategy so the key is stable enough for append-only progress logs
- preserve visible ordering and rendering behavior

### 3. Remove invalid `aria-label` usage on plain `div` containers

Current issues:
- `src/web/AgentPanel.tsx` uses `aria-label` on `.agent-run-controls`
- `src/web/workspace.tsx` uses `aria-label` on similar control containers

Expected fix:
- either remove the unsupported ARIA attributes or convert the container to a semantic element where the label is valid
- do not add decorative ARIA that does not improve usability

### 4. Replace non-semantic clickable containers with semantic controls

Current issues in `src/web/workspace.tsx`:
- graph ticket cards use `div role="button"`
- kanban cards use `div role="button"`

Expected fix:
- convert these interactive containers to real `<button>` elements or another genuinely semantic control
- preserve keyboard interaction, selection behavior, styling hooks, and existing `data-awb` selectors if any are relied upon
- verify Graph and Kanban still behave correctly on desktop and mobile

### 5. Replace non-semantic grouping/list roles with semantic structure

Current issues in `src/web/workspace.tsx`:
- layout direction control uses `div role="group"`
- agent run list uses `div role="list"`
- run rows use `button role="listitem"`

Expected fix:
- use semantic HTML instead of ARIA role emulation
- likely candidates are `fieldset`/`legend` for grouped controls and `ul`/`li` around run-row buttons for the run list
- preserve styling and behavior while improving semantics

### 6. Remove the unnecessary effect dependency in `workspace.tsx`

Current issue:
- the selected-card scroll effect depends on `direction` even though the effect body does not use it

Expected fix:
- trim the dependency list to the values actually used by the effect
- keep selected-card scrolling behavior unchanged

## Acceptance Criteria

- the listed files no longer produce Biome diagnostics
- keyboard and pointer interaction still works for Graph, Kanban, and Agents views
- semantics are improved rather than merely silenced
- `bun test` passes
- `bun run check` moves closer to green with this ticket alone
