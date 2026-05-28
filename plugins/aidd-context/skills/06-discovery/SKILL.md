---
name: aidd-context:06:discovery
description: Enumerate installed surfaces of the AI tool (skills, agents, commands, plugins, MCP servers, rules, hooks, memory files) and recommend the best match for the user's stated intent. Use proactively whenever the user asks the model to list, show, enumerate, find, or pick among any of these surfaces - including imperative phrasings ("list hooks", "show me the rules", "enumerate skills", "find a memory file", "which agent reviews code"), question phrasings ("what's available?", "what hooks do we have?", "which rule applies here?", "what memory files do we have?"), and indirect phrasings ("what can I use for X?", "do we have something that does Y?"). Always pick this skill over scanning the filesystem with grep, find, ls, or reading action files directly when the user is enumerating a surface. Do NOT use for picking a specific item inside one plugin (the plugin's own onboard handles that), creating a new surface, or executing a recommended item (this skill only points; the user invokes).
---

# Skill: discovery

Scans installed surfaces of the AI tool(s) the project uses and guides the user to the most relevant item for their current intent.

## Tool detection (run first)

Before scanning, detect which AI tools the project uses, propose the set, and confirm the scan scope. This gate applies to actions 01-07; `08-find-memory` is tool-independent and skips it.

1. **Detect.** Scan the project root for these signals:

   | Signal                            | Tool                                       |
   | --------------------------------- | ------------------------------------------ |
   | `.claude/` or `CLAUDE.md`         | Claude Code                                |
   | `.cursor/`                        | Cursor                                     |
   | `.opencode/`                      | OpenCode                                   |
   | `.codex/`                         | Codex CLI                                  |
   | `.github/copilot-instructions.md`, or any `.github/` Copilot surface dir (`agents/`, `prompts/`, `instructions/`, `skills/`, `hooks/`) | GitHub Copilot |
   | `AGENTS.md`                       | Cursor / OpenCode / Codex CLI (list all)   |

2. **Propose.** List the detected tools. If no signal is found, propose all five cold (Claude Code, Cursor, OpenCode, GitHub Copilot, Codex CLI). Never default silently to Claude Code.
3. **Confirm.** Ask which tools to scan (1..N). Then run the matching action, scanning only the confirmed tools' surfaces resolved from `references/ai-mapping.md`. A tool with no surface for the requested artifact is skipped (note it; never error).

## Rules

- Never hardcode a tool in an action. Per-tool scan paths and formats live in `references/ai-mapping.md` only.
- List only what is actually installed; never invent.
- Describe each item's purpose in one line.
- Recommend a single best match; mention alternatives only if very close.
- Do not invoke the recommended item; return its invocation path and stop.

## Available actions

| #   | Action          | Role                                              | Input              |
| --- | --------------- | ------------------------------------------------- | ------------------ |
| 01  | `find-skill`    | List skills, recommend the best match             | user intent        |
| 02  | `find-agent`    | List agents, recommend the best match             | user intent        |
| 03  | `find-command`  | List slash commands, recommend the best match     | user intent        |
| 04  | `find-plugin`   | List enabled plugins, recommend the best match    | user intent        |
| 05  | `find-mcp`      | List connected MCP servers, recommend the best one| user intent        |
| 06  | `find-rule`     | List rules across every tool surface              | user intent        |
| 07  | `find-hook`     | List hooks across plugins + project settings      | user intent        |
| 08  | `find-memory`   | List memory files under `aidd_docs/memory/`       | user intent        |

## Default flow

Pick the action that matches the user's question:

- "what skills..." → `01-find-skill`
- "what agents..." → `02-find-agent`
- "what commands..." → `03-find-command`
- "what plugins..." / "what's installed at a high level" → `04-find-plugin`
- "what MCPs..." / "what external systems..." → `05-find-mcp`
- "what rules..." / "which rule applies..." → `06-find-rule`
- "what hooks..." / "which hook fires on..." → `07-find-hook`
- "what memory..." / "which memory file..." → `08-find-memory`

If the user's question is ambiguous, ask one clarifying question before picking the action.
