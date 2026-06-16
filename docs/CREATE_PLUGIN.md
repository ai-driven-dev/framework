# Build your own plugin

This guide walks through building a new plugin for the AI-Driven Dev marketplace, from a blank directory to a merged PR.

For broader OSS contribution rules (commit scopes, release flow), see [`../CONTRIBUTING.md`](../CONTRIBUTING.md). For the framework's architecture, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Adding a skill to an existing plugin

Most contributions add a *skill* to an existing plugin, not a new plugin. Decide two things first:

- **Which plugin** - the owning concern decides; see the [concern taxonomy](ARCHITECTURE.md#plugin-concerns-and-layers). A capability owned by another concern goes in that plugin and you delegate to it. A skill that sequences across several concerns goes in `aidd-orchestrator`.
- **Which number** - `<NN>-<name>` encodes the plugin's logical pipeline order, not a next-free counter. Inserting mid-flow means renumbering downstream folders, their `skills[]` entries, and every `<plugin>:<NN>-name` invocation token - so weigh appending against inserting.

The rest of this guide applies to the skill directory; skip the plugin-registration steps (the plugin already exists - you only edit its `plugin.json` `skills[]`).

## Prerequisites

The same toolchain as any framework contribution:

- Node 20+, pnpm, jq, python3, pipx (`gh` CLI optional). See `Development setup` in [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
- A clear, scannable use case the plugin solves (one or two sentences).

## Step 1 - decide what the plugin does

A good plugin in this marketplace is:

- **Scoped to one phase or one concern.** "Generate user stories", "audit a codebase for tech debt", "rename a Claude Code prompt safely". If you can't say it in one sentence, split it.
- **Composable with siblings.** Avoid duplicating skills already in `aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-pm`, `aidd-orchestrator`, or `aidd-refine`. Discovery-by-description means your plugin can pull on theirs at runtime.
- **Independent of specific other plugins.** Never reference a sibling plugin by name in skill descriptions or READMEs. The discovery rule keeps the marketplace forkable.

## Step 2 - scaffold the directory

Pick a plugin name (lowercase, hyphenated, prefixed with `aidd-`). For this guide, use `aidd-example`.

```
plugins/aidd-example/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── CATALOG.md            # per-plugin index (auto-generated)
├── skills/
│   └── 01-hello/
│       ├── SKILL.md
│       ├── README.md
│       └── actions/
│           └── 01-greet.md
├── agents/               # optional
├── commands/             # optional
├── hooks/hooks.json      # optional
├── rules/                # optional
└── .mcp.json             # optional (MCP servers)
```

A plugin can bundle any of the Claude Code surfaces above; only the manifest and `skills/` are required. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the surface model and real examples.

### `plugin.json`

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "aidd-example",
  "version": "0.1.0",
  "description": "One-sentence summary of what the plugin does. Use when the user says ... Do NOT use for ...",
  "author": { "name": "AI-Driven Dev", "url": "https://github.com/ai-driven-dev" },
  "skills": ["./skills/01-hello"],
  "keywords": ["example"],
  "repository": "https://github.com/ai-driven-dev/framework",
  "homepage": "https://ai-driven.dev",
  "license": "MIT"
}
```

The `skills` array registers each skill directory - a skill that is not listed will not load. The pre-commit hook validates this file against the Claude Code plugin manifest schema; run `pnpm exec lefthook run pre-commit` to confirm.

### `README.md` (plugin-level)

Follow the sibling pattern: one-paragraph description, a `> Status: experimental.` line, a one-line Quick start pointer to your first skill, and a Skills table with one row per skill. See `plugins/aidd-refine/README.md` for a minimal example.

### `skills/01-hello/SKILL.md`

```markdown
---
name: 01-hello
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

## Step 3 - register the plugin

**a. Marketplace manifest** - append an entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "aidd-example",
  "version": "0.1.0",
  "source": "./plugins/aidd-example",
  "description": "One-sentence summary.",
  "strict": true,
  "recommended": false
}
```

`source` is required (without it the plugin won't resolve); `recommended: false` keeps it off the curated install path until it stabilises. The hook validates `marketplace.json` against the marketplace schema on commit.

**b. Release config** - so `release-please` versions the plugin, add it to both:

- `release-please-config.json` → `packages` (with `package-name` + the `plugin.json` `extra-files` entry, copy a sibling block).
- `.release-please-manifest.json` → `"plugins/aidd-example": "0.1.0"`.

Skip this and the plugin will never get a release.

## Step 4 - try it locally

```
/plugin marketplace add .                 # add the local working tree as a marketplace
/plugin install aidd-example@aidd-framework
Use skill aidd-example:01-hello
```

When you change SKILL.md or actions, run `/reload-plugins` in the same Claude Code session.

## Step 5 - document, test, ship

- Run `pnpm exec lefthook run pre-commit` to confirm JSON validity, YAML validity, and SKILL.md frontmatter checks pass. The pre-commit hook also regenerates your `plugins/aidd-example/CATALOG.md` automatically.
- Open a PR using the project template and pick the right commit scope (`feat(aidd-example): ...`). Listing the scope in `commitlint.config.cjs` is encouraged (an unlisted scope warns but does not block).

## Step 6 - release

Once the PR merges to `main`, `release-please` will propose a release PR for your plugin tagged `aidd-example-v0.1.0` (per-plugin tags). Merge the release PR to publish.

## Style guardrails

- English only in committed prose.
- No em-dash characters in text (hyphen instead).
- No cross-plugin references in skill descriptions or READMEs.
- One sentence per `Use when ... / Do NOT use for ...` cue in `description` frontmatter.
- A skill's `name:` is the **folder slug** (`01-hello`), not a prefixed id. The **invocation** token is `<plugin>:<folder>` with a single colon, e.g. `aidd-example:01-hello`.

## Where to ask for help

Open a discussion on the AIDD Discord, or file a `feat:` issue here describing the plugin you want to add.
