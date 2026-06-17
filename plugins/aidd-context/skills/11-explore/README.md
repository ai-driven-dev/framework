← [framework](../../../../README.md) / [aidd-context](../../README.md)

# 11 - Explore

Surveys the current project across three axes so you see what is there, then lets you dig into any of them. It maps the project, it never tells you the next step (that is onboard's job).

## When to use

- "What do we have here?" / "What is installed?" / "What is set up?"
- Browsing the AIDD capabilities, the context layer, or the project shape.
- Finding which skill, agent, rule, or hook fits a goal.

## When not to use

- For the next logical step to take. Use `aidd-context:00-onboard`.
- To run a found item. Explore points, the user invokes.
- To create a new skill, rule, or agent. Use the generators.

## The three axes

- **Tooling**: the installed skills, agents, commands, rules, hooks, MCP servers, and plugins. What you can run.
- **Context**: the memory bank, specs, plans, and the AI context files. What the AI knows.
- **Codebase**: the stack and the high-level structure. What the project is.

## Flow

It detects your AI tools first, then routes by what you asked. Name nothing and `survey` reads the three axes and presents a compact map, then proposes one axis or all. Name an axis (or all) and `drill` goes straight in. `drill` lists the level in full, recommends the single best match with its invocation path when you name a goal, and descends one level deeper on request, a skill into its actions, a memory file into its sections, until a leaf or a stop.

## Details

See [`SKILL.md`](SKILL.md) for the contract, [`actions/`](actions/) for the two actions, and [`references/ai-mapping.md`](references/ai-mapping.md) for the per-tool scan paths.
