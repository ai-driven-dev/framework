# AIDD Installation Guide — {{TOOL_NAME}}

> v{{VERSION}} — AI-Driven Development framework. Structured agents, commands, rules, and skills for {{TOOL_NAME}}.

## What's Inside

```text
{{FILE_TREE}}
```

## Step 1: Copy Files to Your Project Root

{{#IF_CLAUDE}}
Copy **all** the following to your project root:

| Source       | Destination  | What it does                               |
| ------------ | ------------ | ------------------------------------------ |
| `.claude/`   | `.claude/`   | Agents, commands, rules, skills            |
| `CLAUDE.md`  | `CLAUDE.md`  | Memory bank (loaded on every conversation) |
| `.mcp.json`  | `.mcp.json`  | MCP server configuration                   |
| `aidd_docs/` | `aidd_docs/` | Templates, memory, tasks, docs             |
| `.aidd/`     | `.aidd/`     | Framework config (version, file hashes)    |

```bash
cp -r .claude/ CLAUDE.md .mcp.json aidd_docs/ .aidd/ /path/to/your/project/
```

{{/IF_CLAUDE}}
{{#IF_CURSOR}}
Copy **all** the following to your project root:

| Source       | Destination  | What it does                                |
| ------------ | ------------ | ------------------------------------------- |
| `.cursor/`   | `.cursor/`   | Agents, commands, rules, skills, MCP config |
| `AGENTS.md`  | `AGENTS.md`  | Memory bank (loaded on every conversation)  |
| `aidd_docs/` | `aidd_docs/` | Templates, memory, tasks, docs              |
| `.aidd/`     | `.aidd/`     | Framework config (version, file hashes)     |

```bash
cp -r .cursor/ AGENTS.md aidd_docs/ .aidd/ /path/to/your/project/
```

{{/IF_CURSOR}}
{{#IF_COPILOT}}
Copy **all** the following to your project root:

| Source       | Destination  | What it does                                                   |
| ------------ | ------------ | -------------------------------------------------------------- |
| `.github/`   | `.github/`   | Agents, prompts, instructions, skills, copilot-instructions.md |
| `.vscode/`   | `.vscode/`   | MCP config, extensions, keybindings, settings                  |
| `aidd_docs/` | `aidd_docs/` | Templates, memory, tasks, docs                                 |
| `.aidd/`     | `.aidd/`     | Framework config (version, file hashes)                        |

```bash
cp -r .github/ .vscode/ aidd_docs/ .aidd/ /path/to/your/project/
```

{{/IF_COPILOT}}

## Step 2: Initialize Project Context

Run `/init` in your AI assistant. This generates your project context in `aidd_docs/memory/`:

- `project_brief.md` — What the project does
- `architecture.md` — Tech stack, folder structure
- `codebase_map.md` — Key files and entry points
- `coding_assertions.md` — Linting, formatting, type checking
- `testing.md` — Test framework, patterns, coverage
- `deployment.md` — CI/CD, environments
- `vcs.md` — Branching, commit conventions

## Step 3: Customize Rules

Review rules in `{{RULES_DIR}}` and adjust to your coding standards. Rules are loaded automatically by the AI when matching files are edited.

## Step 4: Configure MCP Servers

{{#IF_CLAUDE}}
Edit `.mcp.json` at the project root. Add or remove MCP servers based on your stack.
{{/IF_CLAUDE}}
{{#IF_CURSOR}}
Edit `.cursor/mcp.json`. Add or remove MCP servers based on your stack.
{{/IF_CURSOR}}
{{#IF_COPILOT}}
Edit `.vscode/mcp.json`. Add or remove MCP servers based on your stack.
{{/IF_COPILOT}}

## Next Steps

Read [`aidd_docs/README.md`](aidd_docs/README.md) for development workflows and commands.
