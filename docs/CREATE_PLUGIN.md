# Build your own plugin

This guide walks through building a new plugin for the AI-Driven Dev marketplace, from a blank directory to a merged PR.

For broader OSS contribution rules (commit scopes, release flow), see [`../CONTRIBUTING.md`](../CONTRIBUTING.md). For the framework's architecture, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prerequisites

The same toolchain as any framework contribution:

- Node 20+, pnpm, jq, python3, pipx, `gh` CLI authenticated. See `Development setup` in [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
- A clear, scannable use case the plugin solves (one or two sentences).

## Step 1 - decide what the plugin does

A good plugin in this marketplace is:

- **Scoped to one phase or one concern.** "Generate user stories", "drive an async-dev pipeline", "rename a Claude Code prompt safely". If you can't say it in one sentence, split it.
- **Composable with siblings.** Avoid duplicating skills already in `aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-pm`, `aidd-orchestrator`, or `aidd-refine`. Discovery-by-description means your plugin can pull on theirs at runtime.
- **Independent of specific other plugins.** Never reference a sibling plugin by name in skill descriptions or READMEs. The discovery rule keeps the marketplace forkable.

## Step 2 - scaffold the directory

Pick a plugin name (lowercase, hyphenated, prefixed with `aidd-`). For this guide, use `aidd-example`.

```
plugins/aidd-example/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── CATALOG.md            # optional; per-plugin index
├── skills/
│   └── 01-hello/
│       ├── SKILL.md
│       ├── README.md
│       └── actions/
│           └── 01-greet.md
└── agents/               # optional
```

### `plugin.json`

```json
{
  "$schema": "https://www.schemastore.org/claude-code-plugin-manifest.json",
  "name": "aidd-example",
  "version": "0.1.0",
  "description": "One-sentence summary of what the plugin does. Use when the user says ... Do NOT use for ...",
  "homepage": "https://github.com/ai-driven-dev/aidd-framework/tree/main/plugins/aidd-example"
}
```

The framework's pre-commit hook validates this file against the canonical Claude Code plugin manifest schema. Run `pnpm exec lefthook run pre-commit` to confirm.

### `README.md` (plugin-level)

Follow the sibling pattern: one-paragraph description, a `> Status: experimental.` line, a one-line Quick start pointer to your first skill, and a Skills table with one row per skill. See `plugins/aidd-refine/README.md` for a minimal example.

### `skills/01-hello/SKILL.md`

```markdown
---
name: aidd-example:01:hello
description: One-sentence summary. Use when ... Do NOT use for ...
---

## Available actions

| ID  | Name  | Purpose                                  |
| --- | ----- | ---------------------------------------- |
| 01  | greet | Greet the user and confirm the skill works. |

## Default flow

Run action `01-greet` and return its message.
```

### `skills/01-hello/README.md`

Mirror the sibling pattern: title, paragraph, When to use, When NOT to use, How to invoke, Outputs, Prerequisites, Technical details (link to SKILL.md). ~30-50 lines.

### `skills/01-hello/actions/01-greet.md`

```markdown
# 01 - greet

Greets the caller.

## Inputs

- none

## Outputs

- a short greeting printed in the chat

## Process

1. Print "Hello from aidd-example."
```

## Step 3 - register in the marketplace manifest

Append your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "name": "aidd-example",
  "version": "0.1.0",
  "recommended": false
}
```

The hook validates `marketplace.json` against the marketplace schema on commit. `recommended: false` keeps the plugin off the curated install path until it stabilises.

## Step 4 - try it locally

```
/plugin marketplace add .                 # add the local working tree as a marketplace
/plugin install aidd-example@aidd-framework
Use skill aidd-example:01:hello
```

When you change SKILL.md or actions, run `/reload-plugins` in the same Claude Code session.

## Step 5 - document, test, ship

- Run `pnpm exec lefthook run pre-commit` to confirm JSON validity, YAML validity, and SKILL.md frontmatter checks pass.
- Add at least one scenario under `skills/01-hello/evals/scenarios.json` if you expect future evaluation runs.
- Update `docs/CATALOG.md` if it does not auto-regenerate in your environment.
- Open a PR using the project template and pick the right commit scope (`feat(aidd-example): ...`). The scope must be declared in `commitlint.config.cjs`; add your scope there in the same PR if it is new.

## Step 6 - release

Once the PR merges to `main`, `release-please` will propose a release PR for your plugin tagged `aidd-example-v0.1.0` (per-plugin tags). Merge the release PR to publish.

## Style guardrails

- English only in committed prose.
- No em-dash characters in text (hyphen instead).
- No cross-plugin references in skill descriptions or READMEs.
- One sentence per `Use when ... / Do NOT use for ...` cue in `description` frontmatter.
- Skill IDs in invocation strings use colon-colon: `aidd-example:01:hello`, not dash.

## Where to ask for help

Open a discussion on the AIDD Discord, or file a `feat:` issue here describing the plugin you want to add.
