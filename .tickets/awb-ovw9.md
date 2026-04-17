---
id: awb-ovw9
status: open
deps: []
links: []
created: 2026-04-17T17:41:43Z
type: feature
priority: 2
assignee: Jens Kouros
tags: [ui, git, repo, diff]
---
# Add repository change browser with tree view and diffs

Expose repository changes inside AWB so users can inspect modified files without leaving the app. The feature should eventually include a project tree view with changed files/folders visually highlighted and a way to inspect git diffs for changed files.

## Acceptance Criteria

- a ticket exists to track in-app repository change browsing\n- the ticket captures the desired tree view and git diff capabilities\n- open design and implementation questions are recorded for later refinement


## Notes

**2026-04-17T17:41:50Z**

Initial idea only; refine later. Desired capability: show repository changes inside AWB in two complementary ways. First, provide a tree view of the project folder structure where changed files and their parent folders are visually highlighted or color coded so it is easy to spot where edits happened. Second, allow the user to inspect a git diff for changed files from within the UI. Open questions to resolve later: where this feature lives in the current layout (new tab, side panel, details subview, or agent-adjacent pane), whether the tree should show only changed paths or the whole repository with change highlighting, which git states to support (modified, added, deleted, renamed, untracked, staged vs unstaged), how diffs should be rendered (raw patch, syntax-highlighted unified diff, side-by-side, collapsible hunks), how to handle large repos or large diffs efficiently, whether this should be read-only or include staging/revert actions later, and how this integrates with agent runs so users can quickly inspect what the agent changed.
