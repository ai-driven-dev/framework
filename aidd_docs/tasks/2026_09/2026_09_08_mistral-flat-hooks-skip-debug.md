# Task [mistral-flat-hooks-skip-debug]

Symptom: `aidd framework build --target mistral --flat` warns
`Skipping hooks/ in plugin 'aidd-context' (hooks not supported for this target)`
while Vibe docs document hooks.

## Hypotheses

- [x] H1 Warning comes from `FlatBuildStrategy.writeHooks` because `buildMistralFlatContract().artifacts.hooks.supported === false`. VALIDATED: exact string in `cli/src/application/use-cases/framework/strategies/flat-build-strategy.ts:81`; flag at `tool-contracts.ts:911`.
- [x] H2 Flag follows the no-`HasHooks` convention (`mistral.ts` intersection omits it, same pattern as opencode). VALIDATED: `mistral` is `HasAgents & HasSkills & HasCommands & HasRules & HasMcp & HasPlugins`; opencode comment at `tool-contracts.ts:808`.
- [x] H3 Vibe would consume a copied Claude `hooks/hooks.json` if we flipped the flag. INVALIDATED: docs load only `./.vibe/hooks.toml` then `~/.vibe/hooks.toml`; Claude JSON is never a Vibe config.
- [x] H4 The only shipped plugin hook (`aidd-context` `SessionStart` → `update_memory.js`) maps 1:1 onto a Vibe type. INVALIDATED: Vibe types are `pre_tool` | `post_tool` | `post_agent` only. No session-start event.
- [x] H5 Marketplace Mistral is consistent with flat (also skips hooks). INVALIDATED: `buildMistralContract()` has `hooks.supported: true` and copies Claude `hooks.json` into the plugin tree; Vibe still would not load that file.

## Root cause

Installer skip is intentional and format-correct: Mistral flat has no HasHooks and no Claude→`hooks.toml` translator. Vibe supports hooks; AIDD does not emit them.

## Next (done 2026-09-08)

Kept skip. Flat Mistral warning now uses `skipReason` on the contract:
`Vibe loads .vibe/hooks.toml (pre_tool/post_tool/post_agent); SessionStart has no equivalent`.
Marketplace copy of Claude `hooks.json` is still dead.
