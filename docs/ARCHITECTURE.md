# Architecture

How the AI-Driven Dev Framework composes inside Claude Code.

## High-level

```mermaid
---
title: aidd-framework composition
---
flowchart TB
  subgraph User
    Editor["Claude Code session"]
  end

  subgraph Marketplace["Marketplace (this repo)"]
    Manifest[".claude-plugin/marketplace.json"]
    PluginsDir["plugins/"]
  end

  subgraph Plugins["Plugins (composable units)"]
    Context["aidd-context"]
    Dev["aidd-dev"]
    Vcs["aidd-vcs"]
    Pm["aidd-pm"]
    Orchestrator["aidd-orchestrator"]
    Refine["aidd-refine"]
  end

  subgraph SkillUnit["Each plugin ships"]
    Skills["skills/ (SKILL.md + actions + assets)"]
    Agents["agents/"]
    Hooks["hooks/"]
    Mcp["mcp/"]
  end

  Editor -->|"/plugin marketplace add"| Manifest
  Manifest -->|lists| PluginsDir
  PluginsDir --> Plugins
  Context --> SkillUnit
  Dev --> SkillUnit
  Vcs --> SkillUnit
  Pm --> SkillUnit
  Orchestrator --> SkillUnit
  Refine --> SkillUnit
  Editor -->|"/plugin install"| Plugins
  Editor -->|invokes| Skills
```

## Anatomy of a plugin

Every plugin under `plugins/<plugin>/` follows the same shape:

```
plugins/<plugin>/
├── .claude-plugin/
│   └── plugin.json        # manifest (name, version, description, $schema)
├── README.md              # human-facing landing page
├── CATALOG.md             # per-plugin auto-generated index
├── skills/                # router-based skills
│   └── <NN>-<name>/
│       ├── SKILL.md        # contract (name, description, actions table)
│       ├── README.md       # human-facing skill landing
│       ├── actions/        # atomic actions invoked by the router
│       ├── assets/         # templates and static files
│       ├── references/     # extended docs the skill links into
│       └── evals/          # scenario fixtures
├── agents/                 # named AI agents (optional)
├── hooks/                  # Claude Code hooks (optional)
└── mcp/                    # MCP server configuration (optional)
```

The `plugin.json` is validated against [`claude-code-plugin-manifest`](https://www.schemastore.org/claude-code-plugin-manifest.json) on every commit (via `lefthook`). The marketplace's `marketplace.json` is validated against [`claude-code-marketplace`](https://www.schemastore.org/claude-code-marketplace.json) the same way.

## Skills are routers

A skill's `SKILL.md` is a manifest plus an actions table. Claude Code loads the SKILL.md when the skill is invoked; the body decides which action(s) to run.

```mermaid
---
title: skill router pattern
---
flowchart LR
  User["User: 'Use skill aidd-X:NN:name'"]
  Skill["SKILL.md (router)"]
  Action1["actions/01-step.md"]
  Action2["actions/02-step.md"]
  ActionN["actions/NN-step.md"]
  Out["Outputs: files, labels, PRs, audit logs"]

  User --> Skill
  Skill -->|"choose 1..N"| Action1
  Skill -->|"choose 1..N"| Action2
  Skill -->|"choose 1..N"| ActionN
  Action1 --> Out
  Action2 --> Out
  ActionN --> Out
```

Each action is a self-contained markdown file with inputs, outputs, depends-on, process steps, and a test checklist. Actions can call other skills via the `Skill` tool, enabling capability discovery and delegation across plugins.

## SDLC capability discovery

Two plugins (currently `aidd-dev:00:sdlc` and `aidd-orchestrator`) advertise themselves as SDLC orchestrators in their `description` frontmatter. Other plugins discover them at runtime by matching the description (never by hardcoded plugin name), which keeps the system swappable: replace `aidd-dev` with any plugin that advertises SDLC orchestration and the orchestrator's `02:run-async-dev` skill will delegate to it instead.

```mermaid
---
title: SDLC capability discovery
---
flowchart TB
  Run["aidd-orchestrator:00:async-dev (action=run)"]
  Discover["check-sdlc action"]
  Catalog["skill catalog (runtime)"]
  SDLC1["aidd-dev:00:sdlc (matches)"]
  SDLC2["custom-dev:00:sdlc (also matches)"]
  Delegate["delegate-sdlc action"]
  Result["PR with feat/<slug>, Closes #N"]

  Run --> Discover
  Discover --> Catalog
  Catalog -->|description match| SDLC1
  Catalog -->|description match| SDLC2
  SDLC1 -->|first match wins| Delegate
  Delegate --> Result
```

## Cross-plugin orthogonality

Plugins do not reference each other by name. When skill A needs a capability owned by skill B, it discovers a candidate at runtime through description matching. This rule keeps the marketplace forkable, the plugins swappable, and the docs maintainable.

The rule is enforced both socially (PR template checklist) and mechanically (lefthook hooks could be extended to grep for cross-plugin literal references).

## See also

- [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md) - build and publish your own plugin.
- [`GLOSSARY.md`](GLOSSARY.md) - terminology used across the framework.
- [`CATALOG.md`](CATALOG.md) - every skill in one index.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) - contribution flow.
