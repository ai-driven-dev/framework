---
objective: "A deterministic validator, run by hand and by an aidd-ui hook on every write, rejects any UI record, token, render or code link that breaks the spec."
status: implemented
---

# Plan: aidd-ui foundation, every record and its validator

Source: aidd_docs/tasks/2026_10/2026_10_30_aidd-ui-rework/spec.md, pull request 1 of aidd_docs/tasks/2026_10/2026_10_30_aidd-ui-rework/roadmap.md.

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Records and history | [`phase-1.md`](./phase-1.md) | none |
| 2   | Tokens and renders | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Code link | [`phase-3.md`](./phase-3.md) | 1 |
| 4   | Entry, hook and docs | [`phase-4.md`](./phase-4.md) | 2, 3 |
| 5   | Fit a real project | [`phase-5.md`](./phase-5.md) | 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.designtokens.org/tr/2025.10/format/ | types: color, dimension, fontFamily, fontWeight, duration, cubicBezier, number, and composites strokeStyle, border, transition, shadow, gradient, typography; dimension `{value, unit: px or rem}`, duration `{value, unit: ms or s}`, fontWeight 1 to 1000 or a keyword, cubicBezier four numbers with x in 0..1; `$type` from the token, else the referenced token, else the closest parent group, else invalid; names never start with `$` nor hold `{`, `}`, `.`; a `{a.b}` alias targets a token, never a group; `$extensions` keys in reverse-domain notation; `$deprecated` true, false or a string; themes are not in the format module |
| https://www.designtokens.org/tr/2025.10/color/ | color `$value` is `{colorSpace, components, alpha?, hex?}`, `colorSpace` one of srgb, srgb-linear, hsl, hwb, lab, lch, oklab, oklch, display-p3, a98-rgb, prophoto-rgb, rec2020, xyz-d65, xyz-d50, `components` three numbers or `none`, `hex` six digits |
| https://code.claude.com/docs/en/hooks#posttooluse | PostToolUse reads `tool_input.file_path` on stdin; exit 2 hands stderr back to the agent |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | the hook runs on the user's `node` with built-ins only: plugins ship without `node_modules` (`plugins/aidd-context/hooks/update_memory.js`). Kilo and opencode replay only `node ${CLAUDE_PLUGIN_ROOT}/hooks/<file>` (`cli/src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts:27`) and drop the hook's output (`:77`); Cursor and Copilot drop the matcher (`cli/src/contexts/tools/domain/formats/flat-hooks-merge.ts:109`); Codex runs a hook once trusted (`cli/src/contexts/tools/domain/profiles/codex/profile.ts:54`); a sibling `require` survives every translation (`plugins/aidd-telemetry/hooks/catch-up.cjs:2`). Tool names on hosts other than Claude Code: unverified, stated as a limit | 4 |
| regression | low: no existing file changes behaviour; `01-hello` stays; golden snapshots read `cli/tests/fixtures/framework-real` (`cli/tests/golden/framework-build-golden.e2e.test.ts:17`). Safety-net phase: no | none |
| architecture | aidd-ui gains its first hooks, `hooks/hooks.json` discovered without a manifest key (`plugins/aidd-context/.claude-plugin/plugin.json`). No skill reaches the validator by path: the hook runs it on every write | 4 |
| documentation | `docs/CATALOG.md` hooks block and `plugins/aidd-ui/CATALOG.md` are regenerated at pre-commit (`scripts/sync-generated-docs.mjs:49`, `scripts/summarize-plugin-catalogs.sh`), checked by `scripts/__tests__/architecture-doc-matches-the-tree.test.js`; `plugins/aidd-ui/README.md` says `0.1.0-alpha.0`, `plugin.json` holds `0.2.1-alpha.0`; `scripts/__tests__/fixtures/README.md` lists every fixture | 1, 4 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| A guard ships with the mutation that proves it (`aidd_docs/memory/coding-assertions.md`) | every rule below has one test that its one mutation turns red |
| No code for an input never observed in real data (`aidd_docs/memory/coding-assertions.md`) | composite token values, alias cycles, globs and non-web code are stated limits, not code |
| A plugin never holds its own tests (`aidd_docs/memory/testing.md`) | tests and their fixture go in `scripts/__tests__/` |
| Run the scripts suite wrapped (`aidd_docs/memory/testing.md`) | `node scripts/check-tests-leave-git-alone.js -- node --test ...` |
| A skill never links outside itself (`aidd_docs/memory/architecture.md`) | the validator lives in `hooks/`, reached by the hook, never by a skill path |
| Bundled hooks run Node (`aidd_docs/memory/architecture.md`) | without `node` the hook is silent, stated in the README |

## Decisions

| Decision   | Why |
| ---------- | --- |
| Front matter is flat: `key: value` or `key: [a, b]`, nothing nested; tables in the body carry what has rows | parses with built-ins, no YAML dependency, same reading for an agent and a script |
| Keys and values are English; the spec's states map to `proposed`, `validated`, `coded`, `deprecated` | the plugin and its users' records share the repository's language |
| Themes are a token extension `"$extensions": {"dev.ai-driven.themes": {"<theme>": <value>}}` | the 2025.10 format module defines no themes; extensions are its sanctioned, preserved escape |
| A token's CSS name is `--` plus its path joined by `-` | one rule both renders and the later `tokens.css` generator follow |
| A code link is `path#Export` or `package:<name>#Export` | one file and one export per element, a library component by its package |
| The validator is `hooks/validate-ui.cjs` over modules in `hooks/lib/`, built one module per phase; `hooks/ui-hook.cjs` runs it for PostToolUse and SessionStart | one source of rules for the hand, the hook and every skill that writes |
