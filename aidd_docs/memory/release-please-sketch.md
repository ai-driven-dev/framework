# Release-Please Monorepo Sketch — Phase 0

## Current State

`release-please-config.json`:
- Type: `simple` (single package)
- Single package at `.` (root)
- Version: `3.9.1` (from `.release-please-manifest.json`)
- No `include-component-in-tag` (false)
- No monorepo setup

`release-please --version`: 11.11.0 (available)

## Changes Needed for 4-Plugin Monorepo

### release-please-config.json

Switch from single-package to monorepo configuration:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "simple",
  "include-component-in-tag": true,
  "include-v-in-tag": true,
  "bump-minor-pre-major": false,
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance" },
    { "type": "revert", "section": "Reverts" },
    { "type": "docs", "section": "Documentation" },
    { "type": "refactor", "section": "Refactoring" }
  ],
  "packages": {
    ".": {
      "component": "framework",
      "release-type": "simple"
    },
    "plugins/aidd-context": {
      "component": "aidd-context",
      "release-type": "simple"
    },
    "plugins/aidd-dev": {
      "component": "aidd-dev",
      "release-type": "simple"
    },
    "plugins/aidd-vcs": {
      "component": "aidd-vcs",
      "release-type": "simple"
    },
    "plugins/aidd-pm": {
      "component": "aidd-pm",
      "release-type": "simple"
    }
  }
}
```

### .release-please-manifest.json

Add initial versions for each plugin package:

```json
{
  ".": "3.9.1",
  "plugins/aidd-context": "1.0.0",
  "plugins/aidd-dev": "1.0.0",
  "plugins/aidd-vcs": "1.0.0",
  "plugins/aidd-pm": "1.0.0"
}
```

### Version file per plugin

Each plugin needs a `version.txt` at its root (since `release-type: simple` reads from `version.txt`):
- `plugins/aidd-vcs/version.txt` → `1.0.0`
- `plugins/aidd-context/version.txt` → `1.0.0`
- etc.

### Tag naming

With `include-component-in-tag: true`, tags become:
- `aidd-vcs-v1.0.0` (instead of `v1.0.0`)
- `aidd-context-v1.0.0`
- etc.

The framework root keeps `v3.9.1` style with component `framework`.

## Open Questions

1. Should plugins version independently (1.0.0) or be in sync with the framework (3.9.1)?
   - Recommendation: start at `1.0.0` — plugins are new artifacts
2. Should the root package still release? Or is the framework replaced by plugins?
   - Phase 0 answer: keep root until Phase 12 full migration validates it
3. Does the CLI marketplace adapter expect a specific tag format for plugin versions?
   - Check: `marketplace-registry-adapter.ts` and `plugin-fetcher-adapter.ts`

## Risk Assessment

Low risk. `release-please` monorepo support is mature (v11). The framework's commit history already uses conventional commits (commitlint), so changelog generation will work correctly scoped by `plugins/aidd-vcs/` paths.
