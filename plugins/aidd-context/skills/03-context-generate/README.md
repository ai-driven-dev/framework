← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 03 - Context Generate

Generates the seven context artifacts a project can consume, across the host AI tool(s) detected in the project. Before writing any artifact the skill runs the Model Y gate: detect installed tools from D1 signals, propose the set to the user, wait for explicit confirmation (1..N), then for each (artifact, confirmed tool) look up `references/ai-mapping.md`; if unsupported, block with explanation (D2) and continue the rest.

- **Skills** - router-based: `SKILL.md` router + atomic testable actions + minimal evals.
- **Agents** - single-file agent definitions following the framework's agent template.
- **Rules** - framework rule files governing editor / agent behaviour.
- **Commands** - flat `.md` slash command files (frontmatter + body), for one-shot manual triggers without supporting files.
- **Hooks** - JSON / TOML entries (or a JS/TS plugin module for OpenCode) for lifecycle events, written to the matching scope.
- **Plugins** - full plugin scaffold (a plugin manifest + README + slot dirs, path resolved per tool from `references/ai-mapping.md`; optional seed skill).
- **Marketplaces** - a marketplace catalog file (path resolved per tool from `references/ai-mapping.md`) that distributes one or more plugins.

Evaluations are declared before implementation; every action carries a `## Test`.

## When to use

- Creating a new skill, agent, rule, slash command, hook, plugin, or marketplace from scratch.
- Refactoring an existing skill: adding, removing, or splitting actions.
- Migrating a legacy slash command into a router-based skill.
- Scaffolding a brand-new plugin or stand-up of a plugin marketplace catalogue.

## When NOT to use

- To edit a single action inside an existing skill -> edit the action file directly.
- To write MCP servers.
- To modify project-level `CLAUDE.md` files.

## How to invoke

```
Use skill aidd-context:03-context-generate
```

For skill generation, the skill walks 6 atomic actions:

1. `capture-intent` - clarify the desired output and decide generate-vs-modify.
2. `design-evals` - write a minimal `scenarios.json`.
3. `decompose-actions` - list actions and their `## Test` sentences.
4. `draft-skill` - write the `SKILL.md` router.
5. `write-actions` - write each action file.
6. `validate` - spawn one agent per action, run its `## Test`, and aggregate into a pass/fail report.

The other six artifact types have their own sub-flows under `actions/<sub-domain>/`. Each entry action runs the Model Y tool-resolution gate (detect -> propose -> confirm -> D2 block) before writing.

- `actions/agents/` - single-action agent generation; writes once per confirmed tool.
- `actions/rules/` - single-action rule generation with deterministic category selection; writes once per confirmed tool.
- `actions/commands/` - single-action flat slash command generation; path resolved per tool from `ai-mapping.md`.
- `actions/hooks/` - single-action hook entry generation; iterates over confirmed tools (Claude/Cursor/Codex -> JSON; OpenCode -> JS module; Copilot -> D2 block for project/user-scope hooks).
- `actions/plugins/` - 4-action plugin scaffold flow (capture-intent -> scaffold-tree -> seed-first-skill -> validate); OpenCode D2-blocks (no plugin manifest).
- `actions/marketplaces/` - 3-action marketplace catalog flow (init -> add-plugin-entry -> validate); OpenCode and Copilot D2-block for marketplaces.

## Outputs

- A new or refactored skill directory: `SKILL.md` + `actions/*.md` + `evals/scenarios.json` (when auto-triggered) + optional `references/` and `assets/`.
- Or a generated agent file from `assets/agents/agent-template.md`.
- Or a generated rule file from `assets/rules/rule-template.md`.
- Or a flat slash command file from `assets/commands/command-template.md`.
- Or a hook entry merged into the matching scope's hooks surface (JSON file, TOML table, or JS module per target tool).
- Or a fresh plugin tree with a plugin manifest + README + selected slot dirs (path resolved per tool from `references/ai-mapping.md`).
- Or a marketplace catalog file + one or more plugin entries (path resolved per tool from `references/ai-mapping.md`).

## Prerequisites

- Project initialized with the AIDD context layer (run `02-project-init` first if `aidd_docs/` is missing).
- A clear user intent: which surface to generate and the domain it covers.

## Rules

R1-R11 in [`SKILL.md`](SKILL.md) are the non-bypassable invariants:
`SKILL.md` is a pure router, one skill = one domain, references one-level deep, `SKILL.md` ≤ 500 lines, descriptions must include explicit triggers and a "Do NOT use for..." clause, every action has a `## Test`, auto-trigger skills ship at least 3 eval scenarios, and the tool-resolution gate (detect -> propose -> confirm -> D2 block) runs before writing any artifact in generate mode.

## Technical details

See [`SKILL.md`](SKILL.md) for the full action contract and rules,
`actions/<sub-domain>/` for the sub-domain flows, and the `references/` and `assets/` directories for the per-tool mapping, skill/command/rule authoring conventions, plugin/marketplace/hook specs, and templates.
