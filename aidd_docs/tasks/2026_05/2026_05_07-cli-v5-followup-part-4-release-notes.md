# Release Notes — @ai-driven-dev/cli v4.1.0

> Ready for GitHub release page. Paste as the release body when tagging `v4.1.0`.

---

## @ai-driven-dev/cli v4.1.0 — Noun-first surface + plugin architecture (CLI v5)

This is the stable release of the v5 architecture, consolidating `4.1.0-beta.1` through `4.1.0-beta.11`.

### Headline features

**Noun-first command surface**
Commands are now organized by resource noun: `aidd ai`, `aidd ide`, `aidd marketplace`, `aidd plugin`. All old verb-first spellings are removed.

**Manifest v5 schema**
The manifest (`aidd_docs/manifest.json`) now uses `{ version, tools, marketplaces }`. Fields `docsDir`, `repo`, `mode`, `scripts`, and `topPlugins` are removed. Run `aidd migrate` to upgrade existing projects.

**Plugin architecture — memory stubs owned by plugins**
`CLAUDE.md`, `AGENTS.md`, and `copilot-instructions.md` stubs are no longer bundled in the CLI binary. They are now distributed via the `aidd-context` plugin on the marketplace. Install with `aidd plugin install aidd-context`.

**Marketplace cache**
`aidd marketplace cache list` and `aidd marketplace cache clear` manage the local catalog fetch cache. `MarketplaceCacheEntry` tracks catalog fetch time and size.

**Plugin sync**
`aidd ai sync --source claude` propagates installed plugins from the source tool's manifest to all other installed AI tools via content translation.

**Bundle budget — 500 KB gate**
`dist/cli.js` is checked against a 500 KB budget on every build. Current size: ~440 KB.

---

### Breaking changes

All command spellings from `4.0.x` are removed. The one-line upgrade path:

```bash
aidd migrate
```

Full migration table:

| Old command (4.0.x) | New command (4.1.0) | Notes |
|---|---|---|
| `aidd install ai <tool>` | `aidd ai install <tool>` | Noun-first |
| `aidd install ide <tool>` | `aidd ide install <tool>` | Noun-first |
| `aidd uninstall ai <tool>` | `aidd ai uninstall <tool>` | Noun-first |
| `aidd uninstall ide <tool>` | `aidd ide uninstall <tool>` | Noun-first |
| `aidd cache list` | `aidd marketplace cache list` | Cache scoped to marketplace |
| `aidd cache clear` | `aidd marketplace cache clear` | Cache scoped to marketplace |
| `aidd config list\|get\|set` | removed | `docsDir`/`repo` keys dropped from manifest v5 |
| `aidd sync --source <tool>` | `aidd ai sync --source <tool>` | Under `ai` noun |
| `aidd restore` | `aidd ai restore` | Under `ai` noun |
| `--docs-dir` on setup | removed | `docsDir` field removed from manifest v5 |
| `--mode` on setup/install | removed | Replaced by `--source local\|remote` on `aidd setup` |
| `--path` on install | removed | Local framework path only via `aidd setup --source local --path` |
| `--release`, `--repo`, `--from`, `--switch-mode` | removed | Framework tarball download eliminated |

---

### Migration guide

1. Run `aidd migrate` — detects and strips obsolete manifest entries (scripts, top-level plugins, docsDir). Backs up manifest before write.
2. Replace `aidd install ai <tool>` → `aidd ai install <tool>` in any scripts or CI configs.
3. Replace `aidd install ide <tool>` → `aidd ide install <tool>`.
4. Replace `aidd uninstall ai|ide <tool>` → `aidd ai|ide uninstall <tool>`.
5. Replace `aidd cache` → `aidd marketplace cache`.
6. Replace `aidd sync --source <tool>` → `aidd ai sync --source <tool>`.
7. Remove any `aidd config` calls — `docsDir` and `repo` keys no longer exist in the manifest.
8. If you relied on memory stubs being bundled: `aidd plugin install aidd-context` adds them back via the marketplace.

---

### New commands (v5 surface)

```bash
# AI tools
aidd ai install claude
aidd ai uninstall cursor
aidd ai list
aidd ai status
aidd ai update [tool]
aidd ai sync --source claude [--target cursor] [--force] [--no-plugins]
aidd ai restore [files...] [--tool claude] [--force]
aidd ai doctor

# IDE tools
aidd ide install vscode
aidd ide uninstall vscode
aidd ide list
aidd ide status
aidd ide update [tool]
aidd ide doctor

# Plugins
aidd plugin install aidd-context
aidd plugin list
aidd plugin update
aidd plugin search <query>
aidd plugin pick
aidd plugin sync [--source claude]
aidd plugin status
aidd plugin restore
aidd plugin doctor

# Marketplace
aidd marketplace add acme owner/aidd-plugins
aidd marketplace list
aidd marketplace browse acme
aidd marketplace cache list
aidd marketplace cache clear [acme]

# Setup (scriptable)
aidd setup --source remote --ai claude --ide vscode --recommended-plugins --yes

# Migrate from 4.0.x
aidd migrate [--dry-run] [--non-interactive]
```

---

### Install

```bash
npm install -g @ai-driven-dev/cli@latest
aidd --version   # expect: aidd/4.1.0 ...
```

### Post-install smoke test

```bash
rm -rf /tmp/aidd-v5-test && mkdir /tmp/aidd-v5-test && cd /tmp/aidd-v5-test
aidd setup --source remote --ai claude --yes
aidd ai status
aidd plugin list
```

---

### Notes for beta users

If you were running `4.1.0-beta.X`:
- No manifest migration needed (v5 schema was introduced in beta.1).
- Remove any `4.1.0-beta.*` version pins from install scripts and switch to `@latest`.

---

Refs: `aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-4-stable-release.md`
