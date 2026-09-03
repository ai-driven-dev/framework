# Command authoring

The contract every generated command must satisfy. A command is a one-shot slash trigger (frontmatter plus a body) invoked as `/<name>`.

## Rules

- **R1.** Single objective. One command does one thing, in fewer than ten steps.
- **R2.** The description states what it does, explicit triggers, and a `Do NOT use for` clause. Where a tool has no description field (a plain-markdown command), the command is manual-only by `/<name>`.
- **R3.** No Role section. The role is implicit in the goal. Body in English. `$ARGUMENTS` is the reserved input keyword.
- **R4.** A flat command is for a one-shot trigger. If it needs supporting files or many steps, use a skill instead.
- **R5.** One idea per sentence. Split a sentence that runs past one line. Exceptions: table rows.

## Naming

The file slug is the command name in kebab-case: lowercase, hyphen-separated, no spaces. `Ship Release` becomes `ship-release`. The command is invoked as `/<slug>`.

## SDLC phase taxonomy

An optional way to order commands. If the user opts in, place the command under `commands/<NN>_<phase>/` by phase digit. Otherwise the user picks any location. Never impose a phase.

| Phase | Name          | Covers                                 |
| ----- | ------------- | -------------------------------------- |
| 01    | onboard       | setup, generators, scaffolding         |
| 02    | context       | discovery, PRD, stories, brainstorming |
| 03    | plan          | technical planning, component behavior |
| 04    | code          | implementation, assertions             |
| 05    | review        | code and functional review             |
| 06    | tests         | test writing, journeys                 |
| 07    | documentation | learning, diagrams                     |
| 08    | deploy        | commits, pull requests, tags           |
| 09    | refactor      | performance, security                  |
| 10    | maintenance   | debugging, issues, audits              |

## Arguments

- `$ARGUMENTS`: the full input string as typed. Identical on every tool.
- `$0`, `$1`, ...: positional arguments, shell-quoted. Indexing differs per tool (0-based on some, 1-based on others), so `$1` reads a different argument across tools.

For a portable command, prefer `$ARGUMENTS` and split it in the body. Reach for positionals only on a single-tool command. On Claude Code, a body that never references `$ARGUMENTS` gets `ARGUMENTS: <value>` appended automatically, so reference `$ARGUMENTS` explicitly whenever you want to control where the input lands.

## CLI injection

Wrap a CLI call as `` !`<command>` ``, a bang followed by the backtick-quoted command. Its output is inlined before the prompt runs. Single pass: the output is not re-scanned.

Injection is confirmed only for Claude Code. For every other tool, do not emit it. Describe the command in the body for the agent to run instead.
