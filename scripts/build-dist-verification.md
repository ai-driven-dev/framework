# build-dist.sh Verification Report

**Date:** 2026-05-06  
**CLI version:** aidd/4.1.0-beta.23 node/25.8.0 darwin-arm64  
**Script:** `framework/scripts/build-dist.sh`  
**Branch:** feat/plugin-architecture

---

## Dist Dirs Produced (8 total)

| Dir | Status |
|---|---|
| dist/claude-local | PASS |
| dist/claude-remote | DEFERRED (see below) |
| dist/cursor-local | PASS |
| dist/cursor-remote | DEFERRED |
| dist/copilot-local | PASS |
| dist/copilot-remote | DEFERRED |
| dist/codex-local | PASS |
| dist/codex-remote | DEFERRED |

---

## Assertion Results — Local Mode (4 dirs)

| Dir | manifest v5 | marketplaces.json path="./" | settings extraKnownMarketplaces | settings path="./" | enabledPlugins count |
|---|---|---|---|---|---|
| claude-local | PASS | PASS | PASS | PASS | 5 |
| cursor-local | PASS | PASS | PASS | PASS | 5 |
| copilot-local | PASS | PASS | PASS | PASS | 5 |
| codex-local | PASS | PASS | PASS | PASS | 5 |

### Sample: dist/claude-local

**`.aidd/manifest.json`** (truncated):
```json
{
  "version": 5,
  "tools": {
    "claude": {
      "toolId": "claude",
      "version": "4.1.0-beta.23",
      "files": [{ "relativePath": ".claude/settings.json", "hash": "..." }],
      "plugins": [
        { "name": "aidd-context", "source": { "kind": "local", "path": "./" }, "marketplace": "aidd-framework" },
        { "name": "aidd-dev", ... },
        { "name": "aidd-vcs", ... },
        { "name": "aidd-pm", ... },
        { "name": "aidd-refine", ... }
      ]
    }
  }
}
```

**`.aidd/marketplaces.json`** (after path rewrite):
```json
{
  "version": 1,
  "marketplaces": [
    {
      "name": "aidd-framework",
      "source": { "kind": "local", "path": "./" },
      "scope": "project"
    }
  ]
}
```

**`.claude/settings.json`** (after path rewrite):
```json
{
  "extraKnownMarketplaces": {
    "aidd-framework": {
      "source": { "source": "directory", "path": "./" }
    }
  },
  "enabledPlugins": {
    "aidd-context@aidd-framework": true,
    "aidd-dev@aidd-framework": true,
    "aidd-vcs@aidd-framework": true,
    "aidd-pm@aidd-framework": true,
    "aidd-refine@aidd-framework": true
  }
}
```

### Per-tool settings file paths

| Tool | Settings file |
|---|---|
| claude | `.claude/settings.json` |
| cursor | `.cursor/settings.json` |
| copilot | `.github/copilot/settings.json` |
| codex | `.codex/config.json` |

---

## Deferred: Remote Mode (4 dirs)

**Root cause:** `aidd setup --source remote` fetches the marketplace catalog from GitHub
(`https://api.github.com/repos/ai-driven-dev/aidd-framework/contents/.claude-plugin/marketplace.json?ref=<tag>`).
The `.claude-plugin/marketplace.json` file only exists on the `feat/plugin-architecture` branch locally
and has not been published to GitHub at any tagged ref. All remote mode calls fail with HTTP 404.

**Unblock condition:** Merge `feat/plugin-architecture` to `main` and cut a release tag that includes
`.claude-plugin/marketplace.json`.

**Current state:** Remote dist dirs contain a `deferred.json` stub:
```json
{ "_deferred": "remote mode — catalog not published to GitHub yet", "tool": "claude", "mode": "remote" }
```

Expected output once unblocked (per spec):
```json
{
  "extraKnownMarketplaces": {
    "aidd-framework": {
      "source": { "source": "github", "repo": "ai-driven-dev/aidd-framework", "ref": "<tag>" }
    }
  }
}
```

---

## Issues Found and Fixed in build-dist.sh

### Bug 1: Wrong key name in path rewrite

**Before:** `data.marketplaces`  
**After:** `data.extraKnownMarketplaces`  
The settings JSON uses `extraKnownMarketplaces`, not `marketplaces`.

### Bug 2: Wrong source discriminator

**Before:** `mp.source.kind === 'local'`  
**After:** `mp.source.source === 'directory'`  
The tool settings files use `{ source: "directory", path: "..." }` — `kind` is only used in `marketplaces.json`.

### Bug 3: Path rewrite only covered `.claude/settings.json`

The original script hardcoded `.claude/settings.json`. Fixed to cover all four tool settings paths:
- `.claude/settings.json` (claude)
- `.cursor/settings.json` (cursor)
- `.github/copilot/settings.json` (copilot)
- `.codex/config.json` (codex)

### Bug 4: marketplaces.json not rewritten

Added rewrite for `.aidd/marketplaces.json` absolute `kind: local` paths → `path: "./"`.

---

## Refs

- Task: `aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-12.md` (Phase 12)
- CLI version: `@ai-driven-dev/cli@4.1.0-beta.23`
- OpenCode: not in TOOLS array — deferred per master plan
