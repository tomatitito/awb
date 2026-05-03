---
id: awb-3h1d
status: open
deps: [awb-4m8h, awb-q1ng]
links: []
created: 2026-05-03T10:33:31Z
type: bug
priority: 0
assignee: Jens Kouros
parent: awb-c9wp
tags: [release, packaging, web, install, build]
---
# Fix installed AWB release serving 404 for the web UI

Installed/compiled AWB releases currently start the API server successfully, but the browser UI 404s at / and /index.html. Reproduction: run the installed awb binary from tmux or the shell, then request /. Observed: /api/tickets returns 200 while / and /index.html return 404. Local repo execution via bun dist/cli.js works, which isolates the problem to the compiled release packaging/runtime path. The likely root cause is that production serving expects dist/web on disk relative to the server module, but compiled release artifacts do not include those frontend files.

## Acceptance Criteria

Reproduced with the installed compiled awb binary. Root cause is documented in the ticket notes or linked subtasks. Installed/released awb returns 200 for / and serves the browser UI successfully. The fix does not regress /api/tickets or other API routes.


## Notes

**2026-05-03T10:33:52Z**

Diagnosis from local reproduction: running the installed binary (~/.local/bin/awb) starts successfully and serves /api/tickets, but /, /x, and /index.html all return 404. Running the repo locally via 'bun run start -- --no-open --port 4313' returns 200 for / and /index.html. The current production server resolves static assets from dist/web on disk relative to the server module, while the compiled release artifact currently packages only the executable, awb-install.json, and pi-package metadata. The missing browser payload is dist/web/index.html plus dist/web/assets/*, so the preferred fix is to embed dist/web into the compiled binary and serve it without filesystem assumptions.
