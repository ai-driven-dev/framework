---
name: working-on-cli
description: Guides any change under cli/, whether a tool, a command, a business rule, a failure path, a test or a context. Use when the user wants to edit cli/src, cli/tests, cli/assets or cli/biome-plugins. Not for plugins/.
argument-hint: tool | command | rule | failure | test | context
---

# Working on the CLI

```mermaid
flowchart LR
  addTool([new tool or host format]) --> tool
  newCommand([command]) --> command --> domain
  rule([business rule]) --> domain
  domain --> failure
  error([error or partial failure]) --> failure
  command --> test
  domain --> test
  tool --> test
  newContext([context]) --> context --> test
  test --> green([gates green])
  failure --> test
```

## Actions

Run the flow above. Read only the action for the change, then what it loads.

| Action  | Does                                                      |
| ------- | --------------------------------------------------------- |
| tool    | add an AI tool or follow a host's format change           |
| command | add or change a command                                   |
| domain  | change a business rule inside a context                   |
| failure | handle an error, a missing file or a partial failure      |
| test    | write or fix a test                                       |
| context | create, split or move a context                           |

## Transversal rules

- Paths are rooted at `cli/`.
- A red gate is fixed at its cause, never by an exemption or a wider allow-list.
- A golden, an e2e output or a fixture is a frozen surface: change it only for a deliberate product change, and say so in the commit.
