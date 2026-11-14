# 02 - Write

Render the confirmed agent once per target and write it.

## Input

The confirmed draft, name and targets.

## Process

1. Fill [agent-template.md](../assets/agent-template.md) with the draft into one canonical agent, and remove the scaffold.
2. Plugin source: write the canonical agent at its path in [hosts.md](../references/hosts.md), then read [validate](03-validate.md).
3. Host tools: write the agent's fields and body to the input file, and run the writer with `--plan` per [writer.md](../references/writer.md).
4. Announce each planned path and each dropped field, then run the writer without `--plan`.
   - Non-zero exit: quote the writer's output, then stop.
5. Read [validate](03-validate.md).

## Output

The files written, and the fields each host dropped.

## Rules

- Leave host files to the writer, never edit one by hand.
