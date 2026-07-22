---
name: framework-build-codex
status: frozen
date: 2026-05-26
target: codex
scope: MVP1 (Mode A + agents hybrid)
extends: framework-build-copilot (Mode A v4.4.0, --flat v4.5.0)
---

# Spec — `aidd framework build --target codex`

## Objective

Add `codex` as a target to `aidd framework build`. Output is a Codex-native plugin marketplace tree that ships skills, hooks, and MCP servers as bundled plugin components, plus a **workspace-side agents materialization** (TOML files at `.codex/agents/`) because Codex agents are not plugin-bundleable.

End-user workflow once consumed:

```bash
aidd marketplace add aidd-fw /path/to/dist   # registers Codex plugins
aidd plugin install aidd-dev --tool codex    # installs the plugin runtime parts
# Agents materialized into .codex/agents/aidd-dev-<name>.toml at consume time
```

## Why

Codex's plugin manifest schema includes `skills`, `hooks`, `mcpServers`, `apps` — but **not** `agents` or `commands`. Subagents in Codex are TOML files in `.codex/agents/` (workspace) or `~/.codex/agents/` (user), and Codex docs explicitly mark them as "workspace-only — not bundled in plugins".

Framework plugins ship `agents/*.md` (Claude format). Without translation, Codex users installing `aidd-dev` lose the `planner` / `implementer` / `reviewer` agents entirely. The build must:
1. Emit a Codex-native plugin tree for skills + hooks + mcp.
2. Convert each `agents/<n>.md` to a Codex TOML file with the right schema mapping.
3. Place those TOML files in a path Codex auto-loads (`.codex/agents/` at the **consuming project root**, not in the plugin tree).

The agents path is materialized at **install-time** by `aidd plugin install --tool codex` (already partly wired in v4.x install code), not by the build. The build only needs to **provide the TOML files in the plugin tree** at a known path so the install path picks them up.

## Out of scope

- Targets other than `codex` (cursor / opencode are separate SDLCs).
- A `--flat` variant for codex (deferred — agents workspace path is already the only flat-ish piece codex needs; explicit `--flat` may come later).
- Codex `apps` plugin field (`.app.json`) — framework does not ship apps; emit no `apps` field.
- Codex `rules` or `commands` — framework plugins do not ship these; `commands/` and `rules/` source dirs warn-and-skip (same as copilot Mode A).
- Re-implementing the existing AI-side `plugin install --tool codex` runtime install flow — that path is the consumer; build produces input for it.

## Command

```bash
aidd framework build \
  --source <framework-path> \
  --target codex \
  --out <dist-path>
```

### Flags

- `--source <path>` — required — framework root with `plugins/<name>/.claude-plugin/plugin.json` entries and `.claude-plugin/marketplace.json`.
- `--target codex` — required value for this SDLC.
- `--out <dir>` — required — output directory; auto-wiped and recreated.

No `--flat` and no `--force` in this SDLC.

## Per-plugin pipeline (codex target)

For each `<source>/plugins/<plugin>/`:

1. Read `.claude-plugin/plugin.json`. Validate against bundled Claude plugin manifest schema (ajv). Halt with `JsonSchemaValidationError` on invalid.
2. **Synthesize Codex manifest** at `<out>/plugins/<plugin>/.codex-plugin/plugin.json` (Codex canonical path per docs):
   ```jsonc
   {
     "name": "<from source>",
     "description": "<from source>",
     "version": "<from source>",
     "author": "<from source>",
     "homepage": "<from source, if present>",
     "repository": "<from source, if present>",
     "license": "<from source, if present>",
     "keywords": "<from source, if present>",
     "skills": ["./skills/<name>"],          // when source has skills/
     "hooks": "./hooks/hooks.json",          // when source has hooks/
     "mcpServers": "./.mcp.json"             // when source has .mcp.json
   }
   ```
   - The `agents` field is **omitted** even when source has `agents/` — Codex plugin schema does not support it.
   - Claude-specific fields (`strict`, `$schema`) are dropped.

3. **Materialize Codex plugin content** under `<out>/plugins/<plugin>/`:
   - **Skills** — `skills/<name>/` tree copied byte-for-byte (preserves `SKILL.md` + supporting files).
   - **Hooks** — `hooks/hooks.json` copied as-is. `${CLAUDE_PLUGIN_ROOT}` is **preserved** because Codex docs confirm legacy compat: "Codex sets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` for compatibility with existing plugin hooks". Hook sibling files (e.g. JS scripts under `hooks/`) copied byte-for-byte.
   - **MCP** — `.mcp.json` copied as-is (Codex accepts Claude `mcpServers` shape with `${CLAUDE_PLUGIN_ROOT}` paths).

4. **Convert agents to TOML** (the hybrid piece). For each `<source>/plugins/<plugin>/agents/<n>.md`:
   - Parse the markdown frontmatter + body.
   - Emit `<out>/plugins/<plugin>/codex-agents/<n>.toml` (in-plugin staging path, consumed by `aidd plugin install --tool codex`).
   - TOML schema mapping (deterministic, named):
     - `name = "<from fm.name or <plugin>-<basename>>"`
     - `description = "<from fm.description>"`
     - `developer_instructions = "<body>"` (multi-line string, body is the full markdown content minus frontmatter; pass through unchanged — Codex resolves `${CLAUDE_PLUGIN_ROOT}` and accepts markdown bodies)
     - `model = "<from fm.model, when value is a known Codex model id; otherwise omitted>"`
     - Other Claude frontmatter fields (`tools`, `agents`, `effort`, `isolation`, etc.) dropped — no Codex equivalent.
   - The body's `@./X` / `@../X` / `@${CLAUDE_PLUGIN_ROOT}/X` references are **left untouched** — Codex's expansion rules for these inside developer_instructions are undocumented; preserve verbatim. The install-time consumer surface decides whether to rewrite further.

5. **Content rewrite for `.md` under skills**: same as copilot Mode A — `@./X` → `[X](./X)`, `@../X` → `[X](../X)`, `@${CLAUDE_PLUGIN_ROOT}/X` → markdown link with file-relative path. Skills are user-facing prompt content; markdown link form is more universally readable.

   **Exception** — when the file is a `SKILL.md` and Codex's known behavior expands `${CLAUDE_PLUGIN_ROOT}` (per docs), preserve the variable. Spec defaults to **rewrite** for consistency with the build's invariant that `${CLAUDE_PLUGIN_ROOT}` is plan-time variable; the plan must lock the final rule.

6. **`@{{TOOLS}}/X`** in any `.md` → halt with the existing `FrameworkPlaceholderInPluginError`.

## Marketplace output

Write `<out>/.claude-plugin/marketplace.json` using the **Claude marketplace schema** (the format Codex auto-discovers per docs: "Codex recognizes a legacy-compatible marketplace path at `$REPO_ROOT/.claude-plugin/marketplace.json`").

Schema example:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
  "name": "<source-marketplace-name>",
  "version": "<source-marketplace-version>",
  "description": "<source-marketplace-description>",
  "owner": { "name": "<source-owner-name>" },
  "plugins": [
    {
      "name": "aidd-dev",
      "version": "1.0.0",
      "description": "...",
      "source": "./plugins/aidd-dev",
      "strict": true,
      "recommended": true
    }
  ]
}
```

- Same shape as our Mode A v4.4.0 source-marketplace fixture (already validated by bundled `claude-code-marketplace.json` schema).
- Plugin entries use `source: "./plugins/<name>"` form (Claude directory shape) — Codex resolves this against the marketplace root.

## Behavior

- **Auto-overwrite** `<out>` — wipe and recreate. No `--force` needed.
- **Halt-at-first-failure** per plugin.
- **Stdout** on success: `Built <N> plugins, <M> files written to <out>` (stats only; same wording as copilot Mode A).

## Safety guard

Reuse `InvalidBuildPathsError` from copilot Mode A. Halt if:
- `<out>` resolves to the same path as `<source>`.
- `<out>` is inside `<source>`.
- `<source>` is inside `<out>`.

## Acceptance criteria

1. `aidd framework build --source <framework> --target codex --out /tmp/dist-codex` produces a directory tree:
   - `<out>/.claude-plugin/marketplace.json` (Claude marketplace schema, validates against bundled ajv schema).
   - `<out>/plugins/<plugin>/.codex-plugin/plugin.json` (Codex manifest, schema synthesized per spec).
   - `<out>/plugins/<plugin>/skills/<name>/SKILL.md` + supporting files for every source skill.
   - `<out>/plugins/<plugin>/hooks/hooks.json` and hook sibling files for plugins shipping hooks.
   - `<out>/plugins/<plugin>/.mcp.json` for plugins shipping MCP.
   - `<out>/plugins/<plugin>/codex-agents/<n>.toml` for every source agent (in-plugin staging — consumed by future install path; not in active Codex auto-load location, that's the install's job).
2. Re-running with identical inputs produces byte-identical output (idempotent: deterministic key order in JSON and TOML, no timestamps).
3. The emitted `plugin.json` for every plugin validates against a bundled minimal Codex plugin manifest JSON schema (hand-crafted from docs, shipped as `assets/schemas/codex-plugin-manifest.json` with `$comment` citing source).
4. The emitted `marketplace.json` validates against the existing `assets/schemas/copilot-plugin-marketplace.json` or — if the schema's required-key set differs — against a new `claude-marketplace-manifest.json` bundled schema. Plan decides which.
5. Every `agents/<n>.md` in source produces a corresponding `codex-agents/<n>.toml` in output. TOML body parses successfully via a TOML parser (we already ship a `toml.ts` formatter). The TOML schema includes at minimum `name`, `description`, `developer_instructions`.
6. Skills `.md` content rewrites `@./X` → `[X](./X)`, `@../X` → `[X](../X)`, `@${CLAUDE_PLUGIN_ROOT}/<rel>` → markdown link with file-relative path. Plan locks whether `${CLAUDE_PLUGIN_ROOT}` is preserved or rewritten in skill body.
7. Hooks `hooks.json` is copied byte-for-byte (no path rewrite — Codex expands `${CLAUDE_PLUGIN_ROOT}` natively per docs).
8. MCP `.mcp.json` is copied byte-for-byte with the `mcpServers` top-level key (no shape change).
9. Synthesized `plugin.json` declares `skills`, `hooks`, `mcpServers` only when the corresponding source directory/file exists. The `agents` field is **always omitted** (Codex plugin scope does not include it). `commands` and `rules` source directories warn-and-skip (same as Mode A copilot).
10. Invalid source plugin manifest halts with `JsonSchemaValidationError`. Safety guard violations halt with `InvalidBuildPathsError`. Both error names match the spec verbatim.
11. End-to-end smoke (manual): `aidd marketplace add aidd-fw /tmp/dist-codex --yes && aidd plugin install aidd-dev --tool codex --yes` runs without error against a clean tmp project. Inspect manifest: aidd-dev plugin entry recorded; `.codex/config.json` recommendations registered.
12. Unit + integration tests cover every flat-only pipeline step (manifest synthesis, agent MD→TOML conversion, skill rewrite, hooks/mcp copy, marketplace emission). One E2E scenario asserts tree shape against the in-repo framework fixture.

## Reuse contract

Plan must prove direct reuse of:

- `BuildOutputStrategy` abstraction (`src/application/use-cases/framework/strategies/build-output-strategy.ts`) — codex becomes a third strategy implementation.
- `MarketplaceOutputStrategy` orchestration scaffold (manifest validation, source-marketplace parsing, marketplace emission, safety guard, warn-out-of-scope, halt-at-first-failure).
- `domain/formats/relative-link-rewrite.ts` — direct reuse for `@./` `@../` `@${CLAUDE_PLUGIN_ROOT}/X` rewriting in skill `.md` content.
- `domain/formats/agent-frontmatter-strip.ts` — **NOT** reused for the TOML emission; the codex TOML mapping is a different schema. Build a new helper `domain/formats/codex-agent-toml.ts` that maps Claude agent frontmatter + body to the Codex TOML schema.
- `domain/formats/toml.ts` — reuse the existing TOML stringifier for deterministic output.
- `assets/schemas/copilot-plugin-marketplace.json` — reusable if Codex marketplace shape matches; plan inspects and decides.

Net new code:
- `CodexOutputStrategy`
- `codex-agent-toml.ts` (Claude FM + body → Codex TOML)
- `codex-paths.ts` (shared codex constants: manifest path, agents staging path, marketplace path)
- Bundled `codex-plugin-manifest.json` schema (hand-crafted from docs)

## Docs sources

- Codex plugin overview: https://developers.openai.com/codex/plugins
- Codex plugin build / manifest schema: https://developers.openai.com/codex/plugins/build
- Codex subagents (workspace-only TOML): https://developers.openai.com/codex/subagents
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex MCP: https://developers.openai.com/codex/mcp
- Existing v4 codex tool config: `src/domain/tools/ai/codex.ts`
- Existing CodexOutputStrategy peer: `src/application/use-cases/framework/strategies/{marketplace,flat}-output-strategy.ts`

## Confirmed via docs

- Codex plugin manifest at `.codex-plugin/plugin.json` (NOT `.claude-plugin/`).
- Codex auto-discovers `.claude-plugin/marketplace.json` at repo root (legacy compat).
- Codex expands `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in plugin hooks/MCP for legacy compat.
- Codex plugin schema fields: `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `skills`, `mcpServers`, `apps`, `hooks`, `interface`.
- Codex subagents are TOML files in `.codex/agents/` (workspace-only, **not bundled in plugins**).
- Codex subagent TOML schema required fields: `name`, `description`, `developer_instructions`.
