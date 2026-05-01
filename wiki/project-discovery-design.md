# AWB project discovery design

Related tickets:

- `awb-k2h8` — define how AWB discovers selectable projects

## Goal

Define the source of truth for which project directories AWB may show in a future project selector.

The initial implementation uses an explicit user-level allowlist instead of any form of unrestricted disk scanning.

## Primary discovery model

AWB discovers selectable projects from a user-level configuration file.

This file is the source of truth for projects that may appear in the selector.

### Config locations

AWB uses a per-user config directory:

- macOS: `~/Library/Application Support/awb/config.json`
- Linux: `$XDG_CONFIG_HOME/awb/config.json` or `~/.config/awb/config.json`
- Windows: `%APPDATA%/awb/config.json` or `~/AppData/Roaming/awb/config.json`

### Schema

The initial schema is:

```json
{
  "projects": [
    {
      "root": "/absolute/path/to/project-a",
      "label": "Project A"
    },
    {
      "root": "/absolute/path/to/project-b"
    }
  ]
}
```

Each entry supports:

- `root` — required project root directory
- `label` — optional display label

## Validation and graceful handling

AWB handles problematic entries gracefully.

Behavior:

- missing config file → no projects discovered
- malformed JSON → ignore the file and surface a warning in discovery results
- non-object entries → ignore
- missing or empty `root` → ignore
- non-existent directories → ignore
- duplicate roots → first valid entry wins; later duplicates are ignored
- empty labels → treated as absent

The initial implementation resolves project roots to absolute paths before deduplication.

## Why an explicit allowlist is the primary approach

This matches the current product direction best because it is:

- predictable
- private by default
- cheap to implement
- easy to explain to users
- safe for future UI selectors

The selector should only show projects the user has explicitly listed.

## Rejected alternatives for the initial implementation

### Whole-disk or home-directory scanning

Rejected because it is:

- too broad
- potentially slow
- privacy-hostile
- difficult to make predictable across platforms

### Project-local `.awb/config.json` as the only source

Rejected because a project-local config cannot advertise other projects before switching into them.

Project-local config remains useful for per-project behavior, but not as the selector's only discovery source.

### Recents-only discovery

Rejected as the primary source because recents are not a durable allowlist.

Users need an explicit source of truth that exists independently of recent activity.

## Future extensions

This design leaves room for later additions without changing the initial source of truth:

- recents layered on top of the allowlist
- favorites metadata
- search over the allowlisted set
- import/export helpers for larger project lists

The initial implementation does not block any of those, but it does not require them either.

## Initial implementation surface

The initial implementation provides:

- `src/projects.ts` for discovery and validation
- a user-level config schema
- `GET /api/projects` so a future project selector can consume the allowlist

The selector UI itself can be implemented later against this source of truth.
