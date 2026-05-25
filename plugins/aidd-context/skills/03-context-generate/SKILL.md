---
name: aidd-context:03:context-generate
description: Generate context artifacts (skills, agents, rules, commands, hooks, plugins, marketplaces) across the host AI tool(s) the project uses. Use when the user wants to create, refactor, add or remove actions in a skill, migrate a legacy slash command into a router-based skill, or generate a new agent, rule, command, hook, plugin, or marketplace. Do NOT use for editing a single action inside an existing skill (edit directly), writing MCP servers, or modifying project-level files.
---

# Context Generate

Generates the seven context artifacts a project consumes, with per-tool path resolution.

- **Skills** - router-based: `SKILL.md` router + atomic testable actions + minimal evals.
- **Agents** - single-file agent definitions following the framework's agent template.
- **Rules** - framework rule files governing editor/agent behavior.
- **Commands** - flat `.md` slash command files (frontmatter + body), for one-shot manual triggers.
- **Hooks** - JSON / TOML entries (or a JS/TS plugin module for OpenCode) bound to lifecycle events.
- **Plugins** - full plugin scaffold (a plugin manifest + README + slot dirs, path resolved per tool from `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; optional seed skill).
- **Marketplaces** - a marketplace catalog file (path resolved per tool from `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`) that distributes one or more plugins.

## Sub-flows

Each artifact type has its own sub-flow under `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/<sub-domain>/`. All sub-flows are equal-weight siblings; pick the one matching the user's artifact type.

| Sub-domain     | Actions count | Entry action                                                                                                          | Flow type           |
| -------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `skills`       | 6             | `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/01-capture-intent.md`                               | sequential 01..06   |
| `agents`       | 1             | `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/agents/01-generate-agent.md`                               | single action       |
| `rules`        | 1             | `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/rules/01-generate-rules.md`                                | single action       |
| `commands`     | 1             | `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/commands/01-generate-command.md`                           | single action       |
| `hooks`        | 1             | `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/hooks/01-generate-hook.md`                                 | single action       |
| `plugins`      | 4             | `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/plugins/01-capture-plugin-intent.md`                       | sequential 01..04   |
| `marketplaces` | 3             | `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/marketplaces/01-init-marketplace.md`                       | sequential 01..03   |

## Default flow

For sequential sub-flows, run actions in order. After each action, run its `## Test` before moving to the next. In the `skills` sub-flow, action 02 self-skips when `01` outputs `invocation_mode = manual`.

## Modify flow

`01` of the matching sub-flow (detects modify) → re-decompose or re-edit as needed → final validate action of that sub-flow.

Gate exception: in modify mode the target tool is fixed by the existing artifact's on-disk location. Skip detect, propose, confirm, and D2.

## Runtime tracking

Materialize the sub-flow as a task list at skill entry; a task closes only when its `## Test` passes.

## Transversal rules

- Skills sub-flow MUST apply R1-R10 from `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/generated-skill-rules.md` to every generated skill. Other sub-flows (agents/rules/commands/hooks/plugins/marketplaces) follow their own conventions in `assets/` and `references/`.
- **R11** - Tool resolution gate (generate-only): detect installed tools (D1 signal set), propose the set to the user, wait for explicit confirmation (1..N), then for each (artifact, confirmed tool) look up `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if unsupported, block with explanation (D2) and continue the rest. In modify mode the tool is fixed by the existing artifact's on-disk location - skip the gate entirely. Full procedure: `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`.

## References

- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/generated-skill-rules.md` - R1-R10 rules applied exclusively by the skills sub-flow to every generated skill
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` - shared detect/propose/confirm/D2 procedure (called by every entry action)
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/naming-conventions.md` - tool vs activity naming, hard constraints
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/skill-structure.md` - skill anatomy
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/agents-coordination.md` - multi-agent coordination patterns
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-structure.md` - rule file anatomy
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-writing.md` - rule authoring conventions
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` - syntax and file location reference for AI files (agents, commands, rules, skills)

## Assets (templates to copy)

- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/skill-template.md` - SKILL.md skeleton
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/action-template.md` - action file skeleton
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/evals-template.md` - `scenarios.json` minimal schema
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/agents/agent-template.md` - agent file skeleton
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/rules/rule-template.md` - rule file skeleton
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/commands/command-template.md` - flat slash command skeleton
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/hooks/hooks-template.json` - hook entry skeleton (JSON); `hook-template.js` for OpenCode
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/plugins/plugin-template.json` - plugin manifest skeleton; `plugin-readme-template.md`, `plugin-entry-template.json`
- `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/marketplaces/marketplace-template.json` - marketplace catalog skeleton
