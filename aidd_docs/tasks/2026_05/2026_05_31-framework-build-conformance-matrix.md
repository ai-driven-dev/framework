---
name: framework-build-conformance-matrix
status: verified
date: 2026-05-31
scope: aidd framework build — 5 tools × 2 modes (marketplace + flat)
evidence: 34/34 live conformance checks pass (this doc), golden 9-cell matrix, integration + e2e suites, /tmp smoke
---

# Conformance matrix — `aidd framework build` (all tools, both modes)

The single "check it all" reference: per tool × mode × artifact — the documented native rule, the
produced output, and how it is proven. **Read the [Residual risks](#residual-risks) section before
trusting this for production** — it states exactly what is NOT proven.

## What "verified" means here (and what it does not)

Three layers of proof, strongest first:

1. **Format conformance** (this doc, 34/34): every emitted tree matches the documented on-disk
   shape — paths, manifest dirs, agent format, MCP target + key, config artifacts — asserted
   programmatically against a real build of `tests/fixtures/framework-real`.
2. **Internal correctness**: golden 9-cell matrix (byte-stable, machine-independent), integration
   tests per orchestrator × contract, e2e per target, full suite green; `pnpm build`/`typecheck`/
   `knip:production` green.
3. **Smoke** (`/tmp`): real built binary produces a valid tree; codex TOML parses; `opencode.json`
   parses.

**NOT proven here: live ingestion by each real external tool** (the Cursor app, Codex CLI, Copilot
in VS Code, OpenCode runtime, Claude Code actually *discovering and running* the output). That
requires installing each tool and is the human gate in [Residual risks](#residual-risks).

## Support matrix

| | marketplace | flat |
|---|---|---|
| claude | ✓ | ✓ |
| cursor | ✓ | ✓ |
| copilot | ✓ | ✓ |
| codex | ✓ | ✓ |
| opencode | ✗ (no native marketplace → errors cleanly) | ✓ |

`opencode --target opencode` (non-flat) → `Error: Unsupported target/mode combination` (verified).

## Marketplace mode — conformance

| tool | manifest dir | catalog file | agents | skills | doc source | status |
|---|---|---|---|---|---|---|
| claude | `.claude-plugin/plugin.json` | `.claude-plugin/marketplace.json` | `agents/*.md` (manifest `agents:["./agents"]`) | `skills/<n>/SKILL.md` | code.claude.com/docs/en/plugins-reference, /plugin-marketplaces | ✓ catalog valid, 6 manifests, 30 skills |
| cursor | `.cursor-plugin/plugin.json` | `.cursor-plugin/marketplace.json` | `agents/*.md` (no tools/color) | `skills/<n>/SKILL.md` | cursor.com/docs/reference/plugins | ✓ catalog valid, 6 manifests, 30 skills |
| copilot | `.github/plugin/plugin.json` | `.github/plugin/marketplace.json` | `agents/*.md` | `skills/<n>/SKILL.md` | code.visualstudio.com/docs/copilot/customization/agent-plugins; github/awesome-copilot | ✓ catalog valid, 6 manifests, 30 skills |
| codex | `.codex-plugin/plugin.json` | `.claude-plugin/marketplace.json` (legacy-compat path Codex discovers) | **TOML** (out-of-band; manifest **omits** `agents`) | `skills/<n>/SKILL.md` | developers.openai.com/codex/plugins/build, /subagents | ✓ catalog valid, 6 manifests, 30 skills, 4 TOML agents, no-agents-field confirmed |

## Flat mode — conformance

> **Layout corrected 2026-05-31** after deep-doc validation (see [Deep validation](#deep-validation-2026-05-31)).
> Flat skills/agents are materialized at **ONE level** (bare `<skill>` / `<name>`, no `<plugin>/`
> namespace dir) because every tool except opencode discovers workspace skills/agents flat, and
> skill `SKILL.md` `name` is rewritten to equal its folder (no colons) to satisfy the tools'
> name===folder + `^[a-z0-9]+(-[a-z0-9]+)*$` rules. Collision-safe: zero name clashes across the
> 6 framework plugins, and the flat collision guard (`FlatTargetExistsError`) fails fast otherwise.

| tool | skills | agents (ext) | mcp target (key) | config artifact | doc source | status |
|---|---|---|---|---|---|---|
| claude | `.claude/skills/<skill>/SKILL.md` | `.claude/agents/<name>.md` | `.mcp.json` (`mcpServers`) | — | plugins-reference; skills; sub-agents | ✓ 30 skills (1 level, name===folder), agents, mcp `<plugin>-`prefixed |
| cursor | `.cursor/skills/<skill>/SKILL.md` | `.cursor/agents/<name>.md` (no tools/color) | `.cursor/mcp.json` (`mcpServers`) | — | cursor.com/docs/{skills,subagents,context/mcp} | ✓ 30 skills, agents flat, mcp prefixed |
| copilot | `.github/skills/<skill>/SKILL.md` | `.github/agents/<name>.agent.md` | `.vscode/mcp.json` (`servers`) | — | vscode agent-plugins, custom-agents, agent-skills, mcp-servers | ✓ 30 skills (name===folder), agents flat, mcp prefixed |
| codex | `.agents/skills/<skill>/SKILL.md` | `.codex/agents/<name>.toml` | `.codex/config.toml` (`mcp_servers`) | — (no `skills.config`; discovery by placement) | developers.openai.com/codex/{skills,subagents,config-reference} | ✓ 30 skills, TOML agents (name/description always/developer_instructions), mcp prefixed |
| opencode | `.opencode/skills/<skill>/SKILL.md` (plural) | `.opencode/agents/<name>.md` (`mode: subagent`) | `opencode.json` (`mcp`, type local/remote) | `opencode.json` | opencode.ai/docs/{config,skills,agents,mcp-servers,plugins} | ✓ 30 skills, agents w/ mode, valid json, mcp prefixed, hooks warn-skipped |

## Cross-cutting guarantees (verified)

- **MCP collision safety**: every flat MCP merge key-prefixes servers by `<plugin>-`
  (`aidd-dev-playwright`, `aidd-dev-figma`, `aidd-pm-mcp-atlassian`) → two plugins with the same
  server name cannot collide. Asserted for all 5 tools.
- **Unsupported artifacts** (`rules`, `commands` all tools; `hooks` for opencode) → warn-and-skip,
  never silently dropped, never crash.
- **No regression**: the 5 pre-existing outputs (marketplace claude/cursor/copilot/codex + copilot
  flat) are byte-identical to the pre-refactor baseline (frozen golden + stash-diff).
- **Idempotent + machine-independent**: re-run byte-identical; golden hashes are content-only.
- **Architecture invariant**: zero `if (tool===…)` / `if (kind==="agents")` branches in either mode
  orchestrator (grep gate).

## How to re-run this conformance check

```bash
pnpm build
# build all 9 cells into /tmp (flat needs an existing --out dir; marketplace auto-creates)
# then assert per-artifact rules — see the conformance script in the SDLC transcript / smoke doc
pnpm vitest run tests/golden/framework-build-golden.e2e.test.ts   # 9-cell golden
pnpm vitest run                                                    # full suite
pnpm knip:production
```

## Deep validation (2026-05-31)

A second deep-doc pass validated our actual output against each tool's documented **discovery
rules** (not just format). It found — and we then fixed — real ingestion-breaking defects that
format-conformance + the test suite had missed (tests assert our layout, not the tool's discovery):

| finding | tools | resolution |
|---|---|---|
| flat skills nested under `<plugin>/` not discovered (skills must be 1 level) | claude, cursor, copilot, codex | flattened to `<skillsdir>/<skill>/SKILL.md` |
| flat agents nested under `<plugin>/` not discovered (agents scanned flat) | cursor, copilot | flattened to `<agentsdir>/<name>.<ext>` |
| skill `name` colon-namespaced (`aidd-x:NN:y`) violates name===folder + `^[a-z0-9-]+$` | cursor, copilot, opencode | rewrite `SKILL.md name` → bare folder name (all flat tools) |
| codex `[[skills.config]] path=".agents/skills"` malformed + not a discovery mechanism | codex | removed; discovery is by placement |
| codex agent TOML omits required `description` when source lacks it | codex | always emit `description` |
| opencode agents missing `mode` default to `all`, not `subagent` | opencode | emit `mode: subagent` |

opencode skills were already correct (recursive `**` glob). All fixes verified: 150 SKILL.md
across the 5 tools are 1-level, `name===folder`, colon-free; marketplace output unchanged
(byte-identical, frozen golden).

## Residual risks

What this conformance proof does NOT cover — close before relying on a tool in production:

1. **Live ingestion by each real external tool is the remaining gate.** The output now MATCHES each
   tool's documented discovery rules (deep validation above), but loading by the actual app/CLI was
   not executed here. Human gate per tool: install it, point it at a built tree, confirm
   skills/agents/MCP are discovered and runnable.
   - claude: `aidd marketplace add` + `aidd plugin install --tool claude`, confirm skills load.
   - cursor: confirm Cursor 2.5+ lists the plugin; flat skills resolve in IDE **and CLI/Automations**.
   - copilot: register the marketplace via `chat.plugins.marketplaces`; confirm VS Code lists it.
   - codex: confirm `.codex/agents/*.toml` + `.agents/skills/<skill>/SKILL.md` are picked up.
   - opencode: confirm `.opencode/skills/` discovery and `opencode.json` `mcp` servers load.
2. **Cursor flat skills off-IDE**: docs say recursive, but forum reports flag nested-skill
   resolution bugs in Cursor CLI/Automations. We flatten to 1 level (the documented-safe shape), so
   this risk is mitigated — but confirm in the actual Cursor CLI if you target it.
3. **Per-tool format points flagged UNVERIFIED in the 2026-05-30 research** (we chose the
   safe/documented option; revisit if a tool rejects output):
   - claude: `recommended` catalog field is undocumented (our bundled schema permits it; we emit it).
   - cursor: agent `tools`/`color` frontmatter undocumented → we deliberately do NOT emit them.
   - copilot: plugin-bundled `.mcp.json` top-level key (`servers` vs `mcpServers`) unconfirmed; we
     emit the VS Code `.vscode/mcp.json` with `servers` (documented) in flat mode.
   - codex: the `.md`→TOML conversion *procedure* is undocumented (target keys are verified);
     `config_file` vs auto-discovery precedence unconfirmed.
   - opencode: `plugin`-array local-path/tuple/version-pin forms unconfirmed (we emit no plugin-array
     entries; only `mcp`); `SKILL.md` description min-length / `allowed-tools` unconfirmed.
4. **rules / commands** are intentionally not emitted (framework ships none; `{supported:false}`).
   If a future plugin ships them, the contracts need those artifact kinds turned on per tool.
5. **MCP source coverage**: the fixture ships 3 MCP servers across 2 plugins, so the MCP path is
   exercised — but only with `command`/`args`/`env` shapes. Remote/SSE MCP shapes are untested.

## Verdict

Within the proven layers — **format conformance, discovery-rule conformance (deep validation
2026-05-31), internal correctness, and smoke** — every tool × mode produces output that matches its
documented format AND each tool's documented discovery rules, and is internally correct/regression-
free (marketplace byte-identical). The deep validation closed the highest-risk gap (flat
skill/agent discovery), which format-conformance alone had missed. The remaining confidence gap is
**executing each of the five real tools** against a built tree — a human-run checklist (Residual
risks §1), not a code change.
