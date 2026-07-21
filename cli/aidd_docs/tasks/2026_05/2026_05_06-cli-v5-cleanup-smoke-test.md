# CLI v5 Cleanup — Smoke Test Report

Date: 2026-05-06

## Setup

- CLI binary: `dist/cli.js` (built from `feat/cli-v5-cleanup`)
- All journeys run in fresh temp directories

## Journey 1: Greenfield Setup

**Command**: `aidd setup --source remote --all --recommended-plugins --yes`

**Dir**: `/tmp/smoke-greenfield`

**Output**:
```
Initialized docs directory aidd_docs/
Installed claude, cursor, copilot, opencode, codex, vscode (8 files)
```

**Exit code**: 0

**Verifications**:
- `.aidd/manifest.json` exists with `version: 5`
- No legacy fields: `scripts`, `mode`, `docsDir` absent
- `.claude/settings.json` present
- `.cursor/settings.json` present

**Result**: PASS

---

## Journey 2: Brownfield Migrate

**Command**: `aidd migrate --non-interactive` (v3-era manifest with bundled plugin + scripts section)

**Dir**: `/tmp/smoke-brownfield`

**Fixture**: manifest with `docsDir`, `mode`, `scripts`, and bundled `aidd-context` plugin (no marketplace)

**First run output**:
```
Backup created at .aidd/manifest.json.bak.20260506T194606
Warning: Plugin "aidd-context" could not be re-installed from marketplace.
Migration complete.
```

**Exit code**: 0

**Manifest after first run**:
```json
{"version":5,"tools":{"claude":{"toolId":"claude","version":"1.0.0","files":[],"mergeFiles":[]}},"marketplaces":{}}
```

**Second run (idempotency)**:
```
Nothing to migrate.
```

**Exit code**: 0

**Result**: PASS (including idempotency fix — real bug fixed in `computeMigrationPlan`)

---

## Journey 3: Plugin Install

**Commands**:
1. `aidd setup --source remote --ai claude --yes`
2. `aidd marketplace add local /tmp/smoke-market --yes`
3. `aidd plugin install sample-plugin --tool claude`

**Dir**: `/tmp/smoke-plugin-install`

**Output** (step 3):
```
Installed 'sample-plugin' from 'local' (/tmp/smoke-market).
```

**Exit code**: 0

**Verifications**:
- `.aidd/marketplaces.json` present
- Plugin installed

**Result**: PASS

---

## Journey 4: Sync Plugins (ai sync)

**Commands**:
1. `aidd setup --source remote --ai claude,cursor --yes`
2. Create user agent at `.claude/agents/my-agent.md`
3. `aidd ai sync --source claude --target cursor --include-user-files --force`

**Dir**: `/tmp/smoke-sync`

**Output** (step 3):
```
Syncing claude → cursor...
Synced 1 file, deleted 0 from claude
```

**Exit code**: 0

**Verifications**:
- `.cursor/agents/my-agent.md` created with translated frontmatter

**Result**: PASS

---

## Journey 5: Update Global

**Commands**:
1. `aidd setup --source remote --ai claude,cursor --yes`
2. `aidd update --force`

**Dir**: `/tmp/smoke-update`

**Output** (step 2):
```
Updated claude (1 files)
Updated cursor (1 files)
```

**Exit code**: 0

**Result**: PASS

---

## Journey 6: Clean

**Commands**:
1. `aidd setup --source remote --ai claude --yes`
2. `aidd clean` (non-TTY dry-run)
3. `aidd clean --force`

**Dir**: `/tmp/smoke-clean`

**Step 2 output** (dry-run):
```
The following will be removed:
  claude: 1 files
  manifest: .aidd/
Would remove 1 file across 1 tool. Use --force to confirm.
```

**Step 3 output**:
```
Removing claude files...
Cleaned all AIDD files (1 files removed)
```

**Exit code**: 0

**Verifications**:
- `.aidd/` removed
- `.claude/` removed
- Directory is empty after clean

**Result**: PASS

---

## Summary

| Journey | Command | Result |
|---------|---------|--------|
| 1 Greenfield setup | `setup --source remote --all --recommended-plugins --yes` | PASS |
| 2 Brownfield migrate | `migrate --non-interactive` | PASS |
| 3 Plugin install | `marketplace add` + `plugin install` | PASS |
| 4 Sync plugins | `ai sync --source claude --target cursor` | PASS |
| 5 Update global | `update --force` | PASS |
| 6 Clean | `clean --force` | PASS |

All 6 journeys pass.
