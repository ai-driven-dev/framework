---
name: framework-build-multi-target-marketplace
status: draft
date: 2026-05-30
targets: [claude, cursor]   # codex + copilot already shipped; opencode deferred to flat phase
mode: marketplace (Mode A)
extends: framework-build-copilot (Mode A v4.4.0, --flat v4.5.0), framework-build-codex (v4.5.0)
---

# Spec — `aidd framework build` multi-target marketplace

## Objective

Make `aidd framework build --target <tool>` (marketplace mode) cover **all four marketplace-capable
tools**: `claude`, `cursor`, `copilot`, `codex`. Today the command hard-rejects everything but
`copilot|codex` (`framework.ts:41`). This spec adds `claude` + `cursor` and replaces the
`if/else` strategy ladder with a `(target, mode) → factory` registry so the later flat phase
(opencode + others) slots in without a second refactor.

End-user workflow once consumed (cursor example):

```bash
aidd framework build --source <framework> --target cursor --out /tmp/dist-cursor
aidd marketplace add aidd-fw /tmp/dist-cursor   # registers Cursor plugins
aidd plugin install aidd-dev --tool cursor      # installs the plugin
```

## Why

Decision (this session): **marketplace-first for claude / cursor / copilot / codex**; opencode
deferred to the flat phase because it has **no native marketplace** (confirmed: `opencode.ts:150-154`,
opencode.ai/docs/config). All four in-scope tools share one marketplace.json shape — Copilot and
Cursor explicitly adopted the Claude plugin spec — so the marketplace catalog emit is largely
**shared**, and per-tool work reduces to small deltas (manifest dir name, agent file format, paths).

Research (2026-05-30, primary-source verified) shrank the work:

- **Cursor HAS native first-party plugins + marketplace** since Cursor 2.5 (2026-02-17).
  `.cursor-plugin/marketplace.json` + `.cursor-plugin/plugin.json` — exact paths our code already
  guessed. **Native skills** (`skills/<name>/SKILL.md`, Claude-compatible). Marketplace schema is a
  Claude clone (`name` / `owner` / `plugins[]`). → Cursor strategy is a **near-clone** of the Claude
  marketplace emit with path swaps.
- **Claude** is the source format. A `--target claude` build is a structural copy + Claude-path
  manifest/marketplace synthesis (round-trip / validation symmetry, and a clean base the other
  three are deltas of).

## Scope

| Tool | This spec | Notes |
|---|---|---|
| **claude** | ✅ NEW `ClaudeOutputStrategy` | identity-style: copy plugin trees, synthesize `.claude-plugin/` manifest + marketplace |
| **cursor** | ✅ NEW `CursorOutputStrategy` | near-clone of Claude with `.cursor-plugin/` paths |
| **copilot** | ✅ already shipped | rename `MarketplaceOutputStrategy` → `CopilotOutputStrategy` (clarity only) |
| **codex** | ✅ already shipped | no rework — validated below |
| **opencode** | ❌ deferred | flat phase; no native marketplace |

## Out of scope

- **OpenCode** — no native marketplace; belongs to the flat phase.
- **Flat mode** for claude/cursor/codex — later phase. This spec is marketplace-only.
- **Cursor `.mdc` rules and commands emitters** — the `BuildOutputStrategy` interface has no
  `writeRules`/`writeCommands`, and the framework plugins ship **no** rules/commands source content.
  Emitting them would be dead code. (`commands/` and `rules/` source dirs warn-and-skip, same as
  copilot/codex Mode A.)
- **Codex / Copilot rework** — shipped strategies are validated against the new research (below);
  re-litigating them is out of scope.
- **MCP emit when no source** — framework plugins ship no `.mcp.json` today; the `writeMcp` step
  is present in the interface but is a no-op for current inputs. Do not author MCP source to exercise it.

## Validated — no rework (codex + copilot)

Research confirms the shipped strategies are correct; record this so nobody re-opens them:

- **Codex** `plugin.json` has **no `agents` field** (our `D-8` omission) ✓. Agents are TOML,
  out-of-band in `.codex/agents/` ✓. `${CLAUDE_PLUGIN_ROOT}` is a **legacy alias** Codex still
  resolves (our `D-7` byte-copy of hooks/mcp) ✓. Marketplace auto-discovered at
  `.claude-plugin/marketplace.json` ✓.
- **Copilot** plugin format **is** the Claude Code spec; `.github/plugin/plugin.json` ✓; the manifest
  field for prompt files is `commands` (not `prompts`) — we ship no commands, so untested but the
  emit code is correct ✓.

## Architecture

### Strategy selection — registry, not ladder

Replace the `framework.ts:67` ternary ladder with a `(target, mode) → factory` map in `deps.ts`:

```text
key = `${target}:${mode}`         e.g. "cursor:marketplace", "copilot:flat"
registry["claude:marketplace"]   → ClaudeOutputStrategy
registry["cursor:marketplace"]   → CursorOutputStrategy
registry["copilot:marketplace"]  → CopilotOutputStrategy   (renamed)
registry["copilot:flat"]         → FlatOutputStrategy       (existing)
registry["codex:marketplace"]    → CodexOutputStrategy
# flat phase later adds opencode:flat, cursor:flat, codex:flat without touching the command
```

- Command resolves the factory by key; unknown key → existing "Unsupported target/mode" error path.
- Keyed on `(target, mode)` **deliberately** so the flat phase adds rows, not a refactor (advisor steer).

### No base class — extend helper composition (advisor steer, `7-clean-code` YAGNI)

Keep the parallel-strategy-classes-implementing-one-interface pattern. Factor shared logic into
`marketplace-strategy-helpers.ts` (already holds `listSkillNames`, `detectPluginPresenceFlags`,
`writeSkillTree`, `resolveVersion`, `resolveDescription`). Claude and Cursor manifest synthesis is
near-identical → add **one** shared helper:

```text
synthesizeClaudeStyleManifest(source, presence, { manifestDir, agentsField: boolean })
```

- `manifestDir` = `.claude-plugin` (claude) | `.cursor-plugin` (cursor).
- `agentsField` = true for both (unlike codex which omits it).
- Codex keeps its own `synthesizeCodexPluginManifest` (different field set). DRY via fuller helpers,
  not inheritance.

### Type + guard changes

- `FrameworkBuildTarget` union (`framework-build.ts:4`): `"copilot" | "codex"` →
  `"claude" | "cursor" | "copilot" | "codex"`.
- `framework.ts:41` target guard: accept the four.
- `framework.ts:51` `--flat` guard: unchanged (still copilot-only this phase).

## Per-tool delta (marketplace mode)

| Dimension | claude | cursor | copilot (shipped) | codex (shipped) |
|---|---|---|---|---|
| manifest dir | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` | `.github/plugin/plugin.json` | `.codex-plugin/plugin.json` |
| manifest `agents` field | yes (`./agents`) | yes (`./agents`) | yes (`./agents`) | **omitted** |
| agents file format | `.md` byte copy | `.md` byte copy | `.md` byte copy | `.toml` (out-of-band) |
| skills | `skills/<n>/SKILL.md` 1:1 | `skills/<n>/SKILL.md` 1:1 | 1:1 | 1:1 |
| hooks | `hooks/hooks.json` copy | `hooks/hooks.json` copy | copy | copy |
| marketplace file | `.claude-plugin/marketplace.json` | `.cursor-plugin/marketplace.json` | `.github/plugin/marketplace.json` | `.claude-plugin/marketplace.json` |
| marketplace schema | claude-marketplace | claude-clone | copilot-marketplace | claude-marketplace |

### Cursor specifics (the only real net-new build)

- Marketplace `name` / `owner` / `plugins[]` = Claude shape; `source: "./plugins/<name>"`.
  `plugins[]` max 500 (well within).
- **Agent frontmatter is minimal**: emit `name` / `description` / `model` only. **Do NOT emit
  `tools` or `color`** — Cursor does not document them (research UNVERIFIED). Cursor agents byte-copy
  from source `.md`; if the source carries `tools`, the agent-frontmatter handling must strip it (or
  pass through — plan decides; safest is byte-copy since Cursor ignores unknown frontmatter — verify).
- Skills byte-copy (`SKILL.md` + supporting files); required frontmatter `name` + `description`,
  Claude-compatible — no rewrite needed.
- `.md` content rewrite for `@./X` / `@../X` / `@${CLAUDE_PLUGIN_ROOT}/X`: follow the same rule the
  shipped strategies use (`relative-link-rewrite.ts`); plan locks whether Cursor preserves or
  rewrites `${CLAUDE_PLUGIN_ROOT}`.

### Claude specifics

- Near-identity. Synthesize `.claude-plugin/plugin.json` from source manifest (drop `$schema`,
  preserve `name`/`version`/`description`/`author`/etc., declare `skills`/`agents`/`hooks` per
  presence). Copy plugin trees byte-for-byte. Emit `.claude-plugin/marketplace.json` (claude schema).
- `recommended` field: present in `assets/schemas/claude-marketplace-manifest.json` → emitting it is
  valid (Anthropic docs call it undocumented, but our bundled schema permits it; not a blocker —
  leave shipped behavior unchanged).

## Behavior

- Auto-overwrite `<out>` (wipe + recreate). No `--force` in marketplace mode.
- Halt-at-first-failure per plugin.
- Idempotent: byte-identical output on re-run (deterministic JSON/TOML key order, no timestamps,
  no path-derived hashes — see golden machine-independence below).
- Stdout success: `Built <N> plugins, <M> files written to <out>`.

## Safety guard

Reuse `InvalidBuildPathsError`: halt if `<out>` == `<source>`, `<out>` inside `<source>`, or
`<source>` inside `<out>`.

## Acceptance criteria

1. `aidd framework build --source <fw> --target claude --out /tmp/dist-claude` produces:
   `.claude-plugin/marketplace.json` (validates against bundled `claude-marketplace-manifest.json`),
   `plugins/<p>/.claude-plugin/plugin.json`, `plugins/<p>/skills/<n>/SKILL.md`, `agents/*.md`,
   `hooks/hooks.json` per presence.
2. `aidd framework build --source <fw> --target cursor --out /tmp/dist-cursor` produces the same
   tree shape under `.cursor-plugin/` manifest dir; marketplace validates against the claude-clone
   schema; cursor agent `.md` files contain no injected `tools`/`color`.
3. `--target copilot` and `--target codex` produce **byte-identical** output to the current shipped
   builds (regression guard — registry refactor changes nothing observable).
4. Re-running any target with identical inputs → byte-identical output (idempotent).
5. Unknown `--target` or unsupported `(target, mode)` pair → existing error path, no crash.
6. `commands/` and `rules/` source dirs (if ever present) warn-and-skip for all targets.
7. `synthesizeClaudeStyleManifest` declares `skills`/`agents`/`hooks` only when the source
   directory/file exists.
8. Golden snapshot per target (capture/normalize/diff matrix) — machine-independent: no values
   derived from absolute paths, no path-bearing content hashes (lesson:
   `.claude/skills/test/references/golden-machine-independence.md`).
9. Smoke (manual, in `/tmp` — never repo root, per `smoke-in-tmp.md`): build cursor + claude into
   `/tmp/<name>` with `git init`, `aidd marketplace add` + `aidd plugin install --tool <t>`, assert
   exit 0 and manifest records the plugin.

## Test plan (tiers)

- **unit** — `synthesizeClaudeStyleManifest` (presence permutations, manifest-dir variants),
  cursor agent-frontmatter handling.
- **integration** — `ClaudeOutputStrategy` + `CursorOutputStrategy` against temp fs (manifest
  synthesis, skill tree copy, marketplace emit, safety guard); registry resolution.
- **e2e** — one journey per new target against `tests/fixtures/framework-real/`; assert tree shape.
  Reuse the framework-build golden baseline harness.
- **golden** — extend the command matrix with `--target claude` and `--target cursor`.
- **smoke** — `/tmp` real-binary run (manual gate, documented).

## Reuse contract

Plan must prove direct reuse of:

- `BuildOutputStrategy` interface — claude + cursor become implementations 4 and 5.
- `marketplace-strategy-helpers.ts` — `writeSkillTree`, `detectPluginPresenceFlags`,
  `resolveVersion`, `resolveDescription`, `listSkillNames`.
- `domain/formats/relative-link-rewrite.ts` — `.md` content rewriting.
- `assets/schemas/claude-marketplace-manifest.json` — claude target; cursor reuses or gets a thin
  clone (plan inspects required-key delta and decides).
- The framework-build golden harness (`tests/golden/`).

Net new code:

- `ClaudeOutputStrategy`, `CursorOutputStrategy`
- `synthesizeClaudeStyleManifest` helper (shared by claude + cursor; codex keeps its own)
- `cursor-paths.ts` (manifest dir, marketplace path constants) — mirror of `codex-paths.ts`
- `(target, mode) → factory` registry in `deps.ts`
- `FrameworkBuildTarget` union + command guard extension
- Bundled cursor marketplace schema **only if** required-key set differs from claude's

## Docs sources (primary, verified 2026-05-30)

- Claude: https://code.claude.com/docs/en/plugins-reference , https://code.claude.com/docs/en/plugin-marketplaces , https://code.claude.com/docs/en/skills
- Cursor: https://cursor.com/docs/reference/plugins , https://cursor.com/docs/plugins , https://cursor.com/docs/skills , https://cursor.com/docs/subagents.md , https://github.com/cursor/plugins , https://cursor.com/changelog/2-5
- Copilot: https://code.visualstudio.com/docs/copilot/customization/agent-plugins , https://github.com/github/awesome-copilot (CONTRIBUTING.md, .github/plugin/marketplace.json)
- Codex: https://developers.openai.com/codex/plugins/build , https://developers.openai.com/codex/subagents
- OpenCode (for the deferred flat phase): https://opencode.ai/docs/config/ , https://opencode.ai/docs/plugins/ , https://opencode.ai/docs/skills/

## Confirmed via research

- Cursor: native plugins + marketplace since 2.5 (2026-02-17); `.cursor-plugin/{marketplace,plugin}.json`;
  native `SKILL.md`; agent frontmatter = `name`/`description`/`model`/`readonly`/`is_background`
  (NOT `tools`/`color`); rules are `.mdc` (out of scope here).
- Claude: `recommended` is in our bundled schema (valid to emit); component dirs at plugin root,
  only the manifest in `.claude-plugin/`.
- Copilot/Codex: shipped strategies match current docs — no rework.
- OpenCode: no marketplace; plural dirs (`plugins/`/`skills/`/`agents/`) now canonical — flat phase.
