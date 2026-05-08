# Migration v4.0 → v4.1

This guide covers the breaking changes introduced in v4.1.0 and the steps required to upgrade a project from v4.0.x.

---

## Quick upgrade

```bash
# 1. Install the new CLI
npm install -g @ai-driven-dev/cli@beta   # beta
npm install -g @ai-driven-dev/cli@latest  # stable (post v4.1.0)

# 2. Migrate obsolete manifest entries (backs up manifest before write)
aidd migrate
```

---

## Breaking command changes

| v4.0.x | v4.1.0 | Notes |
|---|---|---|
| `aidd install ai claude` | `aidd ai install claude` | Noun-first: `ai` is the noun |
| `aidd install ai cursor` | `aidd ai install cursor` | |
| `aidd install ide vscode` | `aidd ide install vscode` | Noun-first: `ide` is the noun |
| `aidd uninstall ai claude` | `aidd ai uninstall claude` | Noun-first |
| `aidd uninstall ide vscode` | `aidd ide uninstall vscode` | Noun-first |
| `aidd cache list` | `aidd marketplace cache list` | Cache scoped to marketplace |
| `aidd cache clear` | `aidd marketplace cache clear` | |
| `aidd config get/set/list` | (removed) | Manifest fields no longer user-configurable |
| `aidd sync --source claude` | `aidd ai sync --source claude` | Under `ai` noun |
| `aidd restore` | `aidd ai restore` | Under `ai` noun |

> `aidd status`, `aidd doctor`, and `aidd update` still work as global commands but also
> have noun-scoped forms: `aidd ai status`, `aidd ide status`, etc.

---

## Breaking flag changes

| Old flag | Context | Replacement |
|---|---|---|
| `--repo <owner/repo>` | global | removed — use `aidd marketplace add` |
| `--mode local\|remote` | setup / install | `aidd setup --source local\|remote` |
| `--path <dir>` | install | `aidd setup --source local --path <dir>` |
| `--from <version>` | setup | removed — tarball download eliminated |
| `--switch-mode` | setup | removed |
| `--release <tag>` | install | removed from `install`; available on `aidd setup --source remote --release <tag>` |
| `--docs-dir <path>` | setup | removed — `docsDir` field dropped from manifest v5 |
| `--plugins`, `--mcp`, `--all-plugins`, `--recommended-plugins`, `--no-plugins` | install | `--recommended-plugins` moved to `aidd setup`; plugin management via `aidd plugin` |

---

## Manifest schema changes (v5)

The manifest (`aidd_docs/manifest.json`) structure changes to `{ version, tools, marketplaces }`.

**Removed fields:**

| Field | Notes |
|---|---|
| `docsDir` | Docs directory is no longer configurable |
| `repo` | Repository source removed; use `aidd marketplace` |
| `mode` | Replaced by `--source` on setup |
| `scripts` | Script install removed from the CLI |
| `topPlugins` | Replaced by per-tool `plugins[]` under `tools[id]` |

**Auto-migration:** Run `aidd migrate` — it detects and strips all removed fields, backs up the manifest to `aidd_docs/manifest.backup.json`, and is idempotent (safe to run multiple times).

If you are on v3.x: a backup is written to `.aidd/manifest.backup.json` before any mutation.

---

## Memory stubs (CLAUDE.md, AGENTS.md, copilot-instructions.md)

These files are **no longer bundled** in the CLI binary. They are now distributed via the `aidd-context` plugin on the marketplace.

If you relied on the CLI writing these stubs:

```bash
aidd plugin install aidd-context
```

---

## New features worth knowing

- **Marketplace cache:** `aidd marketplace cache list|clear` manages fetched catalogs locally.
- **Plugin sync:** `aidd ai sync --source claude --target cursor` propagates installed plugins across tools.
- **Format adapters:** The CLI can ingest Cursor, Copilot, Codex, and OpenCode native marketplace formats.
- **Pinned marketplace version:** `aidd setup --source remote --release v4.1.0` pins the catalog version.

---

## Per-tool settings file paths

Marketplace registration and plugin enable state are written to these files:

| Tool | Settings file |
|---|---|
| Claude Code | `.claude/settings.json` |
| Cursor | `.cursor/settings.json` |
| GitHub Copilot | `.github/copilot/settings.json` |
| Codex | `.codex/config.json` |
| OpenCode | `opencode.json` (project root) |

---

## Manual user actions required

| Scenario | Action |
|---|---|
| Private GitHub marketplace | Run `aidd auth login` before `aidd setup` or `aidd marketplace add` |
| Codex plugin enable | Run `codex /plugins` after setup — Codex stores plugin enable in user-global `~/.codex/config.toml` |
| Cursor plugin install | Use the Cursor marketplace UI — Cursor does not yet support project-local programmatic plugin registration |

---

## Checklist

- [ ] `npm install -g @ai-driven-dev/cli@latest` (or `@beta`)
- [ ] Run `aidd migrate` in each project initialized with CLI < 4.1.0
- [ ] Replace `aidd install ai <tool>` → `aidd ai install <tool>` in all CI and onboarding scripts
- [ ] Replace `aidd install ide <tool>` → `aidd ide install <tool>`
- [ ] Replace `aidd uninstall ai|ide <tool>` → `aidd ai|ide uninstall <tool>`
- [ ] Replace `aidd cache` → `aidd marketplace cache`
- [ ] Replace `aidd sync --source <tool>` → `aidd ai sync --source <tool>`
- [ ] Remove any `aidd config` calls
- [ ] Remove `--repo`, `--mode`, `--path` (on install), `--from`, `--switch-mode`, `--docs-dir` flags
- [ ] If memory stubs were relied on: `aidd plugin install aidd-context`

---

Refs:
- [CHANGELOG.md](CHANGELOG.md) — full version history
- [README.md](README.md) — current command surface
- `aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-4-stable-release.md` — pre-flight checklist
- `aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-4-release-notes.md` — release notes draft
