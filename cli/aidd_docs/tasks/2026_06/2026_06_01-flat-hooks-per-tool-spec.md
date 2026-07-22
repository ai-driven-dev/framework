---
name: flat-hooks-per-tool
status: draft
date: 2026-06-01
scope: framework build --flat — correct hook config registration per tool
follows: fix/flat-plugin-prefixed-names (#281)
---

# Spec — flat-mode hooks, correct per-tool registration

## Problem (validated against current docs, 2026-06-01)

Flat mode materializes plugin hooks, but the CONFIG registration is wrong on 4/5 tools — each
tool discovers workspace hooks differently. The hook SCRIPTS are copied correctly (claude/cursor/
copilot under `.<tool>/hooks/<plugin>/`); only the config file/shape/location is wrong.

Framework reality: 2 plugins ship hooks (`aidd-context`, `aidd-refine`), using exactly 2 events —
`SessionStart`, `UserPromptSubmit` — in the Claude nested matcher-group shape
(`{hooks:{EVENT:[{hooks:[{type,command}]}]}}`), commands `node ${CLAUDE_PLUGIN_ROOT}/hooks/...`.

| tool | current (broken) | required |
|---|---|---|
| claude | standalone `.claude/hooks/<plugin>.hooks.json` (ignored) | register in **`.claude/settings.json`** `hooks` key (Claude nested shape) |
| cursor | `.cursor/hooks/<plugin>.hooks.json` (ignored) | single **`.cursor/hooks.json`** `{version:1, hooks:{<event>:[{command}]}}`, **camelCase events**, flat entries |
| copilot | `.github/hooks/<plugin>.hooks.json` nested shape (loads, won't run) | keep path; **flatten** to `hooks.EVENT[]` of `{type,command}` (no matcher-group) |
| codex | `.codex/hooks.json` = **hardcoded install hook** `node .aidd/scripts/update_memory.cjs`, no `hooks` wrapper, scripts not copied | materialize **framework plugin hooks** into `.codex/hooks.json` with `{hooks:{EVENT:[{matcher?,hooks:[{type,command}]}]}}`; copy scripts to `.codex/hooks/<plugin>/` |
| opencode | skipped (warn) | unchanged — correct (JS-module hooks only) |

## Per-tool contract

Each tool's `hooks` ArtifactContract declares HOW its flat hook config is written. Scripts always
copy to `.<tooldir>/hooks/<plugin>/...` (sibling files). `${CLAUDE_PLUGIN_ROOT}` in commands →
`./.<tooldir>/hooks/<plugin>` (project-root-relative; flat has no plugin root + the env var is empty
for non-plugin hooks).

### claude — merge into `.claude/settings.json`
- Read existing `.claude/settings.json` (or `{}`), merge each plugin's `hooks.<EVENT>` arrays
  (additive, append matcher-groups) under the top-level `hooks` key. Keep Claude nested shape.
- Write merged `.claude/settings.json`. Scripts → `.claude/hooks/<plugin>/`. No standalone `.hooks.json`.

### copilot — `.github/hooks/<plugin>.hooks.json`, flat shape
- Keep per-plugin file under `.github/hooks/` (auto-discovered by `*.json` glob).
- Transform: `hooks.EVENT[].hooks[]` → `hooks.EVENT[]` of `{type,command,timeout?}`; drop `matcher`.
- Event names unchanged (PascalCase). Scripts → `.github/hooks/<plugin>/`.

### cursor — single `.cursor/hooks.json`, event-mapped
- Merge all plugins into one `.cursor/hooks.json` = `{ "version": 1, "hooks": { <cursorEvent>: [ {command} ] } }`.
- Event map (Claude → cursor): `SessionStart`→`sessionStart`, `UserPromptSubmit`→`beforeSubmitPrompt`.
  Maintain a small mapping table; an unmapped event → **warn-and-skip that event** (no crash).
- Entry shape: flat `{ "command": "node ./.cursor/hooks/<plugin>/<script>" }` (no `type`, no nested
  `hooks`). Scripts → `.cursor/hooks/<plugin>/`.

### codex — `.codex/hooks.json` from framework plugin hooks (FIX the leak)
- STOP emitting the hardcoded install hook (`node .aidd/scripts/update_memory.cjs`) — that's the
  `aidd ai install --tool codex` behavior, NOT framework-build. Framework-build flat must materialize
  the framework's plugin hooks.
- Write `.codex/hooks.json` = `{ "hooks": { <EVENT>: [ {matcher?, hooks:[{type,command,timeout?,statusMessage?}]} ] } }`
  (Claude nested shape WITH the top-level `hooks` wrapper — confirmed Codex schema). Merge both plugins.
- Copy scripts to `.codex/hooks/<plugin>/`. Command path → `./.codex/hooks/<plugin>/<script>`
  (project-root-relative; `${CLAUDE_PLUGIN_ROOT}` empty in flat). Note caveat: codex repo-local hook
  firing has an open upstream bug (#17532) — out of our control; emit correctly regardless.

## Out of scope
- opencode hooks (correctly skipped).
- The `assets/hooks/*/hooks-template.json` inside skills — those are skill CONTENT (templates), copied
  as-is; not active hooks. Leave untouched.
- Marketplace-mode hooks (plugin-bundled `hooks/hooks.json` inside the plugin tree — correct; frozen).
- Live execution guarantees (codex #17532); trust prompts.

## Acceptance criteria
1. claude flat: `.claude/settings.json` exists with `hooks` key containing SessionStart +
   UserPromptSubmit entries from both plugins; NO standalone `.claude/hooks/*.hooks.json`; scripts present.
2. cursor flat: single `.cursor/hooks.json` with `version:1`, `hooks.sessionStart` + `hooks.beforeSubmitPrompt`,
   flat `{command}` entries pointing at `./.cursor/hooks/<plugin>/...`; NO per-plugin `.hooks.json`.
3. copilot flat: `.github/hooks/<plugin>.hooks.json` in FLAT shape (`hooks.EVENT[]` of `{type,command}`,
   no matcher-group); auto-discoverable.
4. codex flat: `.codex/hooks.json` with top-level `hooks` wrapper + framework plugin hook commands
   (`node ./.codex/hooks/<plugin>/...`), NOT the hardcoded `.aidd/scripts/update_memory.cjs`; scripts copied.
5. opencode flat: still warn-and-skip, no hook files.
6. Marketplace mode byte-identical (frozen golden). Flat golden re-baselined.
7. Hook command paths contain NO unresolved `${CLAUDE_PLUGIN_ROOT}` in flat output.
8. typecheck / biome / knip / full suite green. `/tmp` smoke per tool asserts the above.
9. LIVE: opencode unaffected; if feasible, confirm claude reads `.claude/settings.json` hooks (manual).

## Test plan
- unit: cursor event-map (mapped + unmapped→skip), copilot shape-flatten, claude settings merge (additive,
  existing settings preserved), codex nested-with-wrapper + no install-hook leak.
- integration: FlatBuildStrategy × each tool hook path.
- golden: flat cells re-baselined; marketplace frozen.
- smoke /tmp: per-tool assertions (AC 1-7).
