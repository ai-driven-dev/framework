← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 09 - agent-generate

Write one canonical subagent from intent and render it once per host AI tool, converting to each tool's shape (markdown, or Codex TOML). A sibling of `04-skill-generate` for the agent artifact.

## When to use

- The user wants to create, scaffold, or refactor an agent or subagent.
- Not for other artifacts (skills, rules, commands, hooks).

## Actions

| #   | Action                                       | Purpose                                        |
| --- | -------------------------------------------- | ---------------------------------------------- |
| 01  | [capture-agent](actions/01-capture-agent.md) | Gather the role, propose names, pick the model. |
| 02  | [write-agent](actions/02-write-agent.md)     | Render the agent per tool and write.           |
| 03  | [validate](actions/03-validate.md)           | Check each agent file.                         |
