# Command authoring

The constraints every generated command satisfies. A command is a one-shot prompt the user types as `/<name>`.

## Rules

| Id | Rule | Why |
| --- | --- | --- |
| C1 | One command, one objective, in fewer than ten steps, with no supporting file. | Anything larger belongs in a skill. |
| C2 | `description` is third person: what the command does, in one line. | The menu shows it next to `/<name>`. |
| C3 | The body opens with a title and one line stating the objective, then numbered imperative steps. | A small model follows numbered steps. |
| C4 | Read the user's input with `$ARGUMENTS` only when every target substitutes it; otherwise tell the model to read the chat input. | Copilot and Cursor leave `$ARGUMENTS` literal. |
| C5 | Inline a shell output with `` !`cmd` `` only when every target is Claude Code or OpenCode; otherwise tell the agent to run it. | Other hosts print the syntax literally. |
| C6 | Set `argument-hint` when the command reads `$ARGUMENTS`. | It tells the user what to type. |
| C7 | Write in English, short imperative sentences, one idea each. | The prompt is read by a model. |
| C8 | Set `model`, `agent` or `allowed-tools` only when the user names one. | A default pins every run to one choice. |

## Naming

| Constraint | Example |
| --- | --- |
| Kebab-case, verb first | `ship-release`, `fix-lint` |
| Unique among the target's commands and skills | a skill and a command sharing a name collide |
