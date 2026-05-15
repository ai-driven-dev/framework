← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 03 - Context Generate

Generates the three Claude Code context artifacts a project consumes:
router-based **skills** (`SKILL.md` + atomic testable actions + minimal
evals), **agents**, and **rules**. Evaluations are declared before
implementation; every action gets a `## Test`.

## When to use

- Creating a new skill, agent, or rule from scratch.
- Refactoring an existing skill: adding, removing, or splitting actions.
- Migrating a legacy slash command into a router-based skill.

## When NOT to use

- To edit a single action inside an existing skill → edit the action file
  directly.
- To create slash commands (no router needed for those).
- To write MCP servers.
- To modify project-level `CLAUDE.md` files.

## How to invoke

```
Use skill aidd-context:03:context-generate
```

For skill generation, the skill walks 6 atomic actions:

1. `capture-intent` - clarify the desired output and decide
   generate-vs-modify.
2. `design-evals` - write a minimal `scenarios.json`.
3. `decompose-actions` - list actions and their `## Test` sentences.
4. `draft-skill` - write the `SKILL.md` router.
5. `write-actions` - write each action file.
6. `validate` - spawn one agent per action, run its `## Test`, and
   aggregate into a pass/fail report.

Agent and rule generation each have their own single action (see
`actions/agents/` and `actions/rules/`).

## Outputs

- A new or refactored skill directory: `SKILL.md` + `actions/*.md` +
  `evals/scenarios.json` (when auto-triggered) + optional `references/`
  and `assets/`.
- Or a generated agent file from `assets/agents/agent-template.md`.
- Or a generated rule file from `assets/rules/rule-template.md`.

## Prerequisites

- Project initialized with the AIDD context layer (run `02-project-init`
  first if `aidd_docs/` is missing).
- A clear user intent: what surface to generate (skill / agent / rule) and
  the domain it covers.

## Rules

R1-R10 in [`SKILL.md`](SKILL.md) are the non-bypassable invariants:
`SKILL.md` is a pure router, one skill = one domain, references one-level
deep, `SKILL.md` ≤ 500 lines, descriptions must include explicit triggers
and a "Do NOT use for..." clause, every action has a `## Test`, and
auto-trigger skills ship at least 3 eval scenarios.

## Technical details

See [`SKILL.md`](SKILL.md) for the full action contract and rules,
[`actions/skills/`](actions/skills/) for the skill-generation actions,
`references/naming-conventions.md` for tool-vs-activity naming, and
`assets/skills/`, `assets/agents/`, `assets/rules/` for the templates.
