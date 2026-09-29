---
type: defect
status: reported
---

# Defect: The mistral marketplace route emits plugin trees Vibe cannot detect

## Context

`aidd translate` builds two targets for Mistral Vibe. The flat route materializes `.vibe/skills/` directly and was proven on a real Vibe install (see `aidd_docs/tasks/2026_09/2026_09_08_eisdir-banner-txt-debug.md` and `2026_09_08_vibe-skill-description-debug.md`). The marketplace route (`cli/src/contexts/tools/domain/profiles/mistral/build.ts`) emits a Claude-style native plugin tree with the manifest at `.vibe-plugin/plugin.json`, and `distributionProbes` in `profile.ts` assert that same path.

## Expected

A marketplace-built plugin tree is a tree Vibe discovers as a plugin, and `aidd doctor`'s distribution probes report an installed plugin when Vibe has one.

## Actual

Vibe's own reference defines a native plugin as `plugin.json` at the plugin root (Agent Plugins 1.0), and its foreign-format adapters recognize only `.claude-plugin/`, `.codex-plugin/`, `.kimi(.|-)plugin/`, and `.opencode/` markers. `.vibe-plugin/plugin.json` matches neither, so Vibe never detects the tree and the probes can never fire. Even if detection were fixed, the route's agents-as-markdown (Vibe agents are TOML under `ai.mistral.vibe/agents/`) and foreign-adapted plugin limits (skills and MCP only) would leave parts of the tree dead.

## Reproduction

1. `aidd translate --to mistral` in marketplace mode.
2. Inspect the output tree: manifest at `.vibe-plugin/plugin.json`, agents as `agents/*.md`.
3. Compare against Vibe's plugin format reference: native manifests sit at the plugin root as `plugin.json`.

## Impact

The marketplace route for Mistral Vibe is unverified against the tool it targets; its output is undetectable per Vibe's documented format. The flat route is the only proven path. Anyone installing via the marketplace route gets files nothing reads.

## Evidence

- Vibe reference skill, plugin system section: native manifest `plugin.json` at plugin root; foreign format table (Claude, Codex, Kimi, OpenCode); foreign plugins contribute skills and MCP only.
- `cli/src/contexts/tools/domain/profiles/mistral/mistral-paths.ts`: `OUTPUT_MISTRAL_MANIFEST_RELATIVE = ".vibe-plugin/plugin.json"`.
- The route was never exercised against a real Vibe install; only the flat route has an install verification on record.

## Verification

A marketplace-built tree is discovered by Vibe as a plugin on a real install, and the distribution probes report it.

## Cancellation

—
