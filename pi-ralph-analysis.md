# Pi Ralph Analysis

## Summary

The original `ralph-loop-ts` direction is no longer the best fit for the actual goal.

The real target workflow is:

1. work inside the `tk-viewer` project
2. select one or more `tk` tickets
3. have pi implement them in a Ralph-style iterative loop
4. keep the implementation as small and local as possible

Given that goal, the smallest sensible solution is to use **a project-local pi extension** instead of continuing to build a standalone TypeScript Ralph loop wrapper around pi.

## Why a pi extension is enough

Pi extensions already provide the primitives needed for Ralph-loop behavior:

- slash commands for starting and stopping work
- lifecycle hooks such as `before_agent_start` and `agent_end`
- session state and persistence
- follow-up message scheduling for iterative looping
- direct integration with pi's normal tool use and session model

This means the project does not need its own separate:

- CLI entrypoint
- runtime wrapper around pi
- artifact/logging subsystem
- config-resolution layer for a standalone app

## Minimal architecture for the new direction

Inside `tk-viewer`, the first implementation should live in a project-local extension, for example:

```text
/Volumes/sourcecode/personal/tk-viewer/
  .pi/
    extensions/
      ralph-workbench.ts
```

If it grows, it can become:

```text
.pi/
  extensions/
    ralph-workbench/
      index.ts
      decision.ts
      handoff.ts
      state.ts
      tickets.ts
```

A very small MVP would support a command like:

- `/ralph-tickets TK-123 TK-124`

The extension would then:

1. resolve ticket details via `tk`
2. inject iteration instructions into pi
3. inspect the result after each agent run
4. decide whether to continue, stop, or move to the next ticket
5. queue the next iteration with a follow-up message when needed

## What can be reused

The reusable parts from this repository are the small, pure pieces of logic:

- iteration decision logic
- handoff-summary generation
- optional guard/check evaluation logic

These can simply be copied or moved into the extension folder.

There is no need to preserve them as a separate package yet.

## What should be abandoned

The following parts of `ralph-loop-ts` are no longer worth actively developing for the current goal:

- standalone CLI
- standalone runtime abstractions around pi
- artifact-writing subsystem
- config-resolution for a separate command-line tool
- mock pi runtime scaffolding

## Recommendation

Stop active development of `ralph-loop-ts` as a standalone implementation.

Use pi's extensibility to obtain Ralph-loop behavior directly inside the target project (`tk-viewer`), and keep any reused TypeScript logic next to the extension code until a second consumer exists.
