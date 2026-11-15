# 02 - Write

Render the confirmed command once per target and write it.

## Input

The confirmed draft, name and targets.

## Process

1. Fill [command-template.md](../assets/command-template.md) with the draft into one canonical command, and remove the scaffold.
2. Plugin source: write the canonical command at its path in [hosts.md](../references/hosts.md), then read [validate](03-validate.md).
3. Host tools: write the command's fields and body to the input file, and run the writer with `--plan` per [writer.md](../references/writer.md).
4. Announce each planned path and each dropped field, then run the writer without `--plan`.
   - Planned `update`: show it, end the turn and wait for the user's own approval, then add `--force`.
   - Non-zero exit: quote the writer's output, then stop.
5. Read [validate](03-validate.md).

## Output

The files written, and the fields each host dropped.

## Rules

- Leave host files to the writer, never edit one by hand.
