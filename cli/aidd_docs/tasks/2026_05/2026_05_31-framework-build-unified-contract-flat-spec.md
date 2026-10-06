---
name: framework-build-unified-contract-flat
status: done
date: 2026-05-31
supersedes-architecture-of: 2026_05_30-framework-build-multi-target-marketplace (PR #279, marketplace claude+cursor)
targets: [claude, cursor, copilot, codex, opencode]
modes: [marketplace, flat]
---

# Spec — unified `ToolBuildContract` + flat parity (all tools, both modes)

## Objective

Two things, one coherent refactor:

1. **Unify the build architecture** behind a single per-tool `ToolBuildContract` driven by
   two thin per-mode orchestrators (`MarketplaceBuildStrategy`, `FlatBuildStrategy`), replacing
   the per-tool strategy classes shipped in PR #279 (`ClaudeOutputStrategy`,
   `CursorOutputStrategy`, `CopilotOutputStrategy`, `CodexOutputStrategy`) and the copilot-only
   `FlatOutputStrategy`. Tool specifics live in the contract (where the tool def already holds
   `buildInstallPath` + merge helpers); the mode orchestrators own the per-plugin loop.
2. **Add flat mode (Mode B) parity** for `claude`, `cursor`, `codex`, `opencode` (copilot flat
   already ships; it gets retrofitted onto the contract).

End state — every `(target, mode)` pair is one registry row mapping to `mode-orchestrator(tool-contract)`:

```
                marketplace          flat
claude          ✓ (retrofit)         ✓ NEW
cursor          ✓ (retrofit)         ✓ NEW
copilot         ✓ (retrofit)         ✓ (retrofit)
codex           ✓ (retrofit)         ✓ NEW
opencode        — (no marketplace)   ✓ NEW  ← load-bearing: only path to any opencode support
```

## Why

PR #279 scattered tool specifics across four near-duplicate marketplace strategy classes; the
flat strategy is copilot-hardcoded. The tool definitions (`src/domain/tools/ai/*.ts`) **already
are** per-tool contracts — `buildInstallPath` per capability, `codexAgentMarkdownToToml`,
`ensureSkillsConfig`/`mergeCodexConfigToml`, `mergeOpencodeMcp`/`transformMcpToOpencode`,
`mergeVscodeMcp`. A per-tool `ToolBuildContract` centralizes the deltas there and lets one
marketplace orchestrator + one flat orchestrator drive all five tools. This maximizes reuse and
makes both modes structurally identical — the goal stated by the maintainer.

OpenCode has no native marketplace (`opencode.ts` is `mode: "flat"`); flat is the only path to
any opencode support, so opencode flat is load-bearing — if anything is cut, it is not opencode.

## Architecture

### `ToolBuildContract` (per tool) — artifact-symmetric

A plugin carries **six artifact kinds**: `skills`, `agents`, `mcp`, `hooks`, `rules`, `commands`.
The contract treats them **uniformly** — it does NOT special-case agents. For each artifact kind a
tool declares one `ArtifactContract` (or `unsupported`), so adding/per-tool behavior is symmetric
and a reader sees, per tool, exactly which artifacts it supports and how each is laid out/transformed:

```text
type ArtifactContract =
  | { supported: false }                               // tool has no native concept → warn-and-skip
  | {
      supported: true
      // where it lands (REUSE the tool def's existing buildInstallPath = primary-dir path)
      path(plugin, relPath): string                    // marketplace: plugin-tree path; flat: primary-dir + <plugin> namespace
      ext?: string                                     // output ext override (.agent.md, .toml) — else preserve source
      transform?(content, ctx): string                 // per-kind transform: byte-copy default | strip tools/color | →TOML | json
      merge?(existing, incomingPrefixed, force): {...}  // for config-file kinds (mcp) — REUSE existing merge helpers
    }

interface ToolBuildContract {
  manifestDir: string | null                           // .claude-plugin | .cursor-plugin | .github/plugin | .codex-plugin | null (opencode)
  marketplaceRelative: string | null                   // catalog path (marketplace mode); null when tool has no marketplace
  synthesizeManifest(source, presence): object | null  // marketplace manifest; null when n/a

  artifacts: {
    skills:   ArtifactContract                          // all 5 tools: supported (1:1 SKILL.md; codex remaps to .agents/skills/)
    agents:   ArtifactContract                          // claude/cursor/copilot/opencode: .md; codex: →TOML; transform per tool
    mcp:      ArtifactContract                          // supported all; merge into tool's mcp target, key-prefixed by <plugin>
    hooks:    ArtifactContract                          // codex: .codex/hooks.json; others: per tool or unsupported (warn-skip)
    rules:    ArtifactContract                          // { supported: false } for now — framework ships none (out of scope)
    commands: ArtifactContract                          // { supported: false } for now — framework ships none (out of scope)
  }

  emitConfigArtifact?(builtPlugins, outDir): Promise<number>  // codex config.toml skill-reg; opencode.json; else absent
}
```

Why symmetric: the maintainer's point — a contract that only exposes `transformAgent` lies about
the shape of a plugin. Skills, mcp, hooks each have their own per-tool path + transform too. One
`ArtifactContract` per kind makes support explicit (`supported:false` ⇒ warn-and-skip, the same
path `commands`/`rules` already take), removes hidden agent-special-casing, and lets the two mode
orchestrators iterate artifact kinds generically with zero `if (kind === "agents")` branches.

- **claude + cursor** share a parameterized contract factory — same artifact set, differ only in
  `manifestDir`/`DIRECTORY` and cursor's `agents.transform` stripping `tools`/`color`. Mirrors the
  shipped `synthesizeClaudeStyleManifest` reuse.
- **codex** contract: `agents.transform` = `codexAgentMarkdownToToml` + `ext: .toml`; `skills.path`
  = `.agents/skills/` remap; `emitConfigArtifact` = `config.toml` skill-reg; `mcp.merge` = `mergeCodexConfigToml`.
- **opencode** contract: plural dirs; `manifestDir/marketplaceRelative` = null; `mcp` merges into
  `opencode.json` via `mergeOpencodeMcp`+`transformMcpToOpencode`; `emitConfigArtifact` = opencode.json.
- **copilot** contract: wraps existing flat-paths + `agents.ext = .agent.md` + `mcp.merge = mergeVscodeMcp`.

### Per-tool × artifact support matrix

| artifact | claude | cursor | copilot | codex | opencode |
|---|---|---|---|---|---|
| skills | ✓ `.md` 1:1 | ✓ 1:1 | ✓ 1:1 | ✓ remap `.agents/skills/` | ✓ 1:1 (plural) |
| agents | ✓ `.md` byte | ✓ `.md` strip tools/color | ✓ `.agent.md` | ✓ →`.toml` | ✓ `.md` |
| mcp | ✓ `.mcp.json` | ✓ `.cursor/mcp.json` | ✓ `.vscode/mcp.json` | ✓ `config.toml` | ✓ `opencode.json` |
| hooks | per def* | per def* | `.github/hooks/` | `.codex/hooks.json` | per def* |
| rules | ✗ skip | ✗ skip | ✗ skip | ✗ skip | ✗ skip |
| commands | ✗ skip | ✗ skip | ✗ skip | ✗ skip | ✗ skip |

\* hooks output path per tool locked in the plan from the tool def; only context/refine plugins
ship hooks. rules/commands = `{ supported:false }` (framework ships none); plan confirms whether any
tool's hooks are also `unsupported` (→ warn-skip) vs materialized.

### Two mode orchestrators (implement `BuildOutputStrategy`)

- `MarketplaceBuildStrategy(contract)` — current marketplace per-plugin pipeline (manifest synth,
  skill tree, agents, hooks, mcp, `postBuild` = marketplace catalog). Drives the contract.
- `FlatBuildStrategy(contract)` — current copilot flat pipeline generalized (primary-dir +
  per-plugin namespace, collision/`--force`, `${CLAUDE_PLUGIN_ROOT}` rewrite, MCP key-prefix merge,
  `postBuild` = `emitConfigArtifact`). Drives the contract.

`FrameworkBuildUseCase` orchestrator is unchanged — it already calls `strategy.write*` + `postBuild`.

### Registry

`(target,mode) → modeStrategy(toolContract)` in `deps.ts`. opencode:marketplace absent (unsupported
pair → existing error path). Remove the `--flat` copilot-only guard in `framework.ts`.

### Reuse (confirmed against code)

| Need | Reuse | Location |
|---|---|---|
| primary-dir path per artifact | per-capability `buildInstallPath` | tool defs (claude:52, cursor:55/63, codex `buildCodexSkillFilePath`:207, opencode:110/118) |
| agent → TOML (codex) | `codexAgentMarkdownToToml` | `formats/codex-agent-toml.ts` |
| codex config.toml skill-reg + mcp merge | `ensureSkillsConfig`, `mergeCodexConfigToml`, `mergeMcpServers` | `tools/ai/codex.ts:78-122` |
| opencode.json mcp merge + transform | `mergeOpencodeMcp`, `transformMcpToOpencode` | `formats/opencode-mcp-merge.ts:22`, `tools/ai/opencode.ts:70` |
| vscode mcp merge (copilot) | `mergeVscodeMcp` | `formats/vscode-mcp-merge.ts:36` |
| flat path primitives | extract generic from `copilot-flat-paths.ts` | `formats/copilot-flat-paths.ts` |
| `${CLAUDE_PLUGIN_ROOT}` + `@./`,`@../` rewrite | `rewriteRelativeLinks`, `rewriteClaudeRootInJson` | `formats/relative-link-rewrite.ts`, `claude-root-path-rewrite.ts` |
| manifest synth (claude/cursor/copilot) | `synthesizeClaudeStyleManifest` | `marketplace-strategy-helpers.ts` |
| `@{{TOOLS}}/` guard | `assertNoToolsPlaceholder` | `shared-plugin-helpers.ts` |

## Correctness locks (advisor — hold regardless of architecture)

1. **MCP key-prefix namespacing for EVERY tool's flat MCP merge.** claude `.mcp.json` and cursor
   `.cursor/mcp.json` sit at primary locations with no plugin isolation → two plugins' servers
   collide. Mandate `<plugin>-` key prefix (as copilot flat does) for all tools, via the existing
   merge helpers. Never reimplement a merge.
2. **Regression baseline is a PRE-CHANGE capture, NOT the committed `golden.json`.** The contract
   retrofit MUST keep ALL current outputs byte-identical: marketplace for claude/cursor/copilot/codex
   AND copilot flat. Capture the baseline from the current branch HEAD (post-#279) BEFORE the
   refactor (stash-diff / built-binary diff technique), gate every phase against it. `golden.json`
   alone proves only idempotency.

## Per-tool flat layout (workspace materialization)

| Tool | skills | agents (+ext) | hooks | mcp target | config artifact |
|---|---|---|---|---|---|
| claude | `.claude/skills/<plugin>/…` | `.claude/agents/<plugin>/` `.md` | `.claude/hooks/<plugin>.hooks.json`* | `.mcp.json` (`mcpServers`, prefixed) | — |
| cursor | `.cursor/skills/<plugin>/…` | `.cursor/agents/<plugin>/` `.md` (no tools/color) | `.cursor/hooks/…`* | `.cursor/mcp.json` (`mcpServers`, prefixed) | — |
| copilot | `.github/skills/<plugin>/…` | `.github/agents/<plugin>/` `.agent.md` | `.github/hooks/<plugin>.hooks.json` | `.vscode/mcp.json` (`servers`, prefixed) | — |
| codex | `.agents/skills/aidd-…` (remap) | `.codex/agents/` `.toml` | `.codex/hooks.json`* | `.codex/config.toml` (`mcp_servers`) | `.codex/config.toml` skill-reg |
| opencode | `.opencode/skills/<plugin>/…` (plural) | `.opencode/agents/` `.md` | — | `opencode.json` (`mcp`) | `opencode.json` (mcp/plugin) |

\* hooks output path per tool to be locked in the plan from the tool def; only plugins shipping
hooks emit them (context/refine plugins). Skill-dir nesting (`<plugin>/<skill>/SKILL.md`) must be
**validated by smoke against real tool discovery** per tool — locked in the plan, proven in smoke.

## Out of scope

- Commands / rules emitters — interface has no `writeCommands`/`writeRules`; framework ships no
  such source. `commands/`,`rules/` source dirs warn-and-skip (unchanged).
- Flat MCP tracking manifest (un-merge on uninstall) — fire-and-forget, as copilot flat is today.
- opencode marketplace mode — no native marketplace; permanently absent from the registry.
- New web research — native formats already verified (2026-05-30 research, marketplace spec).

## Acceptance criteria

1. Every existing output is BYTE-IDENTICAL to the pre-refactor HEAD baseline: `--target {claude,
   cursor,copilot,codex} ` (marketplace) and `--target copilot --flat`. This is the retrofit gate.
2. `--target claude --flat --out <dir>` materializes `.claude/skills/<plugin>/…`,
   `.claude/agents/<plugin>/*.md`, `.mcp.json` (prefixed) into the workspace; exit 0.
3. `--target cursor --flat` likewise under `.cursor/`; agent `.md` carry NO `tools`/`color`.
4. `--target codex --flat` emits `.codex/agents/*.toml` (valid TOML, `name`/`description`/
   `developer_instructions`), skills under `.agents/skills/`, and registers skills in
   `.codex/config.toml` (`[[skills.config]]`, idempotent) + merges `mcp_servers`.
5. `--target opencode --flat` emits `.opencode/skills/<plugin>/…`, `.opencode/agents/*.md`, and
   merges MCP into `opencode.json` (`mcp`, `type: local|remote`); plural dirs; `.jsonc` detection honored.
6. All flat MCP merges key-prefix by `<plugin>-`; two plugins with same server name do not collide.
7. `--flat` works for all 5 targets; the copilot-only guard is gone; unknown `(target,mode)` →
   existing error path (incl. `opencode --` non-flat = unsupported).
8. Idempotent: re-run byte-identical (all targets, both modes). Golden matrix machine-independent.
9. Collision without `--force` → `FlatTargetExistsError`; `--out` not a dir → `OutDirNotDirectoryError`.
10. `ToolBuildContract` is the single home of tool specifics; `MarketplaceBuildStrategy` +
    `FlatBuildStrategy` contain no per-tool `if (tool === …)` AND no per-artifact
    `if (kind === "agents")` branching — both orchestrators iterate artifact kinds generically.
11. Unsupported artifacts (`rules`/`commands`, and any tool-unsupported `hooks`) warn-and-skip via
    `{ supported: false }` — no silent drop, no crash.

## Test plan

- **unit** — each contract's `transformAgent`, `synthesizeManifest`, `flat*Path`; the claude/cursor
  shared factory; codex TOML + config.toml reg; opencode json transform/merge.
- **integration** — `MarketplaceBuildStrategy` + `FlatBuildStrategy` × each contract (temp fs):
  tree shape, MCP prefixing/merge, collision/force, config-artifact emission.
- **e2e** — flat journey per new target against `tests/fixtures/framework-real/`.
- **golden** — matrix: 5 tools × applicable modes (9 cells). Machine-independent.
- **regression** — pre-change baseline diff for the 5 existing outputs (AC #1) at every phase.
- **smoke** (`/tmp` only, never repo root): per tool, build flat into `/tmp/<name>` + run the real
  tool's discovery where feasible; minimum assert exit 0 + expected tree + (codex) valid TOML +
  (opencode) valid `opencode.json`. Opencode + codex smoke are mandatory (novel formats).

## Sequencing (regression-safe)

1. Define `ToolBuildContract`; extract generic flat path primitives from `copilot-flat-paths`.
2. Retrofit copilot+claude+cursor+codex marketplace onto `MarketplaceBuildStrategy(contract)` —
   prove marketplace output byte-identical (AC #1, marketplace half).
3. Retrofit copilot flat onto `FlatBuildStrategy(contract)` — prove copilot flat byte-identical
   (AC #1, flat half). Delete `FlatOutputStrategy` + per-tool marketplace classes.
4. claude + cursor flat (near-clone, shared contract).
5. codex flat (TOML + config.toml).
6. opencode flat (json-merge + plural dirs) — load-bearing.
7. golden matrix + e2e + /tmp smoke (codex + opencode mandatory).

## Knowledge update (skills) — after implementation

This refactor changes how the codebase models tool-specific build behavior, so the dev-skills layer
must be updated once shipped (run via `aidd-context:05-learn` / direct edit):

- **`tool` skill** — UPDATE: the canonical way to add a tool's framework-build behavior is now
  "implement a `ToolBuildContract` (artifact-symmetric: skills/agents/mcp/hooks/rules/commands, each
  supported-or-skip)", NOT "write a new `*OutputStrategy` class". Point at the contract + the two
  mode orchestrators. This is the highest-value update (the old `tool` skill guidance is now stale).
- **`format` skill** — likely a NOTE: per-artifact transforms (agent→TOML, mcp→opencode) live as
  pure functions reused by the contract; no change to the format-skill rules, just a cross-ref.
- **New skill?** — evaluate whether a dedicated `framework-build` / `tool-build-contract` skill is
  warranted, or whether the `tool` skill absorbing the contract section is enough. Decide AFTER the
  code lands (don't pre-create — YAGNI). Capture the "artifact-symmetric contract over per-tool
  classes" decision + the regression-baseline-not-golden lesson regardless.

## Docs sources

Native formats verified 2026-05-30 (see `2026_05_30-framework-build-multi-target-marketplace-spec.md`
§"Docs sources"). No new research required.
