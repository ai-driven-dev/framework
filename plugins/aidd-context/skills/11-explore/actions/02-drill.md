# 02 - Drill

Dig into one axis the user picked, list it in full, and recommend a best match when the user has a specific intent.

## Input

The axis the user chose: a Tooling surface (skills, agents, commands, rules, hooks, MCP, plugins), Context, or Codebase. Plus an optional goal.

## Output

A full listing of the chosen axis or surface, and, when the user gave a goal, a single best-match recommendation with its invocation path.

## Process

1. **List in full.** Enumerate the chosen axis from the same sources as the survey (`@../references/ai-mapping.md` for the Tooling and Context surfaces). For a Tooling surface, render a table: the item, where it lives, and its one-line purpose. For a rule scan, the `scripts/list-rules.mjs` helper inventories rules across every tool surface.
2. **Match the goal.** When the user named a goal, score the items against it and pick the single best match. Mention a close second only when it is genuinely tied.
3. **Point.** Give the best match's exact invocation path. Never run it.
4. **Loop or stop.** Offer to dig into another axis or stop. Wait for the answer.

## Test

- The listing covers the chosen axis with only present items. When a goal was given, exactly one best match is named with its invocation path, and nothing is invoked.
