← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 06 - Discovery

Enumerates installed surfaces across the AI tool(s) the project uses
(skills, agents, commands, plugins, MCP servers, rules, hooks, memory
files) and recommends the single best match for the user's stated
intent. Detects which tools are installed, proposes them, and scans
only the confirmed surfaces (per `references/ai-mapping.md`). Lists only
what is actually installed - never invents - and stops at the
recommendation without invoking the target.

## When to use

- Imperative phrasings: "list hooks", "show me the rules", "enumerate
  skills", "find a memory file", "which agent reviews code".
- Question phrasings: "what's available?", "what hooks do we have?",
  "which rule applies here?", "what memory files do we have?".
- Indirect phrasings: "what can I use for X?", "do we have something
  that does Y?".
- Always pick this over scanning the filesystem with `grep`, `find`,
  `ls`, or reading action files directly.

## When NOT to use

- To pick a specific item inside one plugin → that plugin's own onboard
  skill handles internal navigation.
- To create a new surface (skill, agent, rule) → use
  `03-context-generate`.
- To execute the recommended item - this skill only points; the user
  invokes.

## How to invoke

```
Use skill aidd-context:11-discovery
```

The skill picks one action based on what the user is enumerating:

| Action            | Trigger keywords                            |
|-------------------|---------------------------------------------|
| `01-find-skill`   | "what skills…"                              |
| `02-find-agent`   | "what agents…"                              |
| `03-find-command` | "what commands…"                            |
| `04-find-plugin`  | "what plugins…", "what's installed"         |
| `05-find-mcp`     | "what MCPs…", "what external systems…"      |
| `06-find-rule`    | "what rules…", "which rule applies…"        |
| `07-find-hook`    | "what hooks…", "which hook fires on…"       |
| `08-find-memory`  | "what memory…", "which memory file…"        |

When the question is ambiguous, the skill asks one clarifying question
before picking an action.

## Outputs

- A short list of installed items on the requested surface, each with a
  one-line purpose.
- A single recommended best match with its invocation path.
- Alternatives mentioned only if they are very close in fit.

## Prerequisites

- Plugin `aidd-context` installed and enabled.
- The other surfaces (plugins, skills, agents, MCP servers, etc.) must
  already be installed to appear in the listing - discovery never
  invents.

## Technical details

See [`SKILL.md`](SKILL.md) for the dispatch rules and the eight enumeration
actions in [`actions/`](actions/). Each `find-*` action reads from the
runtime's installed inventory for its surface and stops after returning
the recommendation.
