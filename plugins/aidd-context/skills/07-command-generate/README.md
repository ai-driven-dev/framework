← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 10 - command-generate

Write one canonical slash command from intent and render it once per host AI tool that supports commands. A sibling of `04-skill-generate` for the command artifact.

## When to use

- The user wants to create, scaffold, or refactor a one-shot slash command.
- Not for multi-step skills (use the skill generator) or other artifacts (rules, agents, hooks).

## Actions

| #   | Action                                          | Purpose                                    |
| --- | ----------------------------------------------- | ------------------------------------------ |
| 01  | [capture-command](actions/01-capture-command.md) | Capture the goal, location, and arguments. |
| 02  | [write-command](actions/02-write-command.md)     | Write the command file per supported tool. |
| 03  | [validate](actions/03-validate.md)               | Check each command file.                   |
