---
name: framework-build-multi-target-marketplace-smoke
date: 2026-05-30
targets: [claude, cursor]
status: documented
---

# Smoke test — `aidd framework build` claude + cursor targets

Manual gate (AC #9). All runs are in `/tmp` — never repo root.

## Prerequisites

- `pnpm build` completed (dist/cli.js present)
- `tests/fixtures/framework-real` available

## 1. Build cursor target

```bash
rm -rf /tmp/smoke-cursor
node dist/cli.js framework build \
  --source tests/fixtures/framework-real \
  --target cursor \
  --out /tmp/smoke-cursor
```

Expected: exits 0, prints `Built 6 plugins, 198 files written to /tmp/smoke-cursor`.

Verify tree shape:

```bash
ls /tmp/smoke-cursor/.cursor-plugin/marketplace.json
ls /tmp/smoke-cursor/plugins/*/.cursor-plugin/plugin.json
```

Verify no `tools:` or `color:` in cursor agents:

```bash
grep -rn "^tools:" /tmp/smoke-cursor/plugins/*/agents/ && echo "FAIL: tools found" || echo "OK: no tools"
grep -rn "^color:" /tmp/smoke-cursor/plugins/*/agents/ && echo "FAIL: color found" || echo "OK: no color"
```

## 2. Build claude target

```bash
rm -rf /tmp/smoke-claude
node dist/cli.js framework build \
  --source tests/fixtures/framework-real \
  --target claude \
  --out /tmp/smoke-claude
```

Expected: exits 0, prints `Built 6 plugins, 198 files written to /tmp/smoke-claude`.

Verify tree shape:

```bash
ls /tmp/smoke-claude/.claude-plugin/marketplace.json
ls /tmp/smoke-claude/plugins/*/.claude-plugin/plugin.json
```

## 3. Register cursor marketplace and install plugin

```bash
cd /tmp && mkdir smoke-cursor-project && cd smoke-cursor-project && git init
node /path/to/dist/cli.js marketplace add aidd-fw /tmp/smoke-cursor --yes
node /path/to/dist/cli.js plugin install aidd-dev --tool cursor --yes
```

Expected: exits 0, success message containing `aidd-dev`.

## 4. Register claude marketplace and install plugin

```bash
cd /tmp && mkdir smoke-claude-project && cd smoke-claude-project && git init
node /path/to/dist/cli.js marketplace add aidd-fw /tmp/smoke-claude --yes
node /path/to/dist/cli.js plugin install aidd-dev --tool claude --yes
```

Expected: exits 0, success message containing `aidd-dev`.

## 5. Cleanup

```bash
rm -rf /tmp/smoke-cursor /tmp/smoke-claude /tmp/smoke-cursor-project /tmp/smoke-claude-project
```

## Notes

- Hooks/MCP: framework-real plugins ship `hooks/hooks.json` and `.mcp.json`. Both are byte-for-byte copied (no `${CLAUDE_PLUGIN_ROOT}` rewrite) because Claude and Cursor runtimes expand it natively.
- This smoke is not automated — it is reviewer-run. The automated gates are in `tests/e2e/framework-build.e2e.test.ts` and `tests/application/use-cases/framework/`.
