# 01 - Survey

Read the project across the three axes and present a compact map. Scan quietly, then give one grouped overview.

## Input

The project root.

## Output

A map grouped by axis, Tooling, Context, and Codebase. Each axis lists what is there, one line per item or a short count, with no recommendation. Then an offer to dig into one axis.

## Process

1. **Detect the tools.** Find which AI tools the project uses from the signals in `@../references/ai-mapping.md`. Propose the set when it is ambiguous, never assume one silently.
2. **Scan Tooling.** For each detected tool, gather the installed skills, agents, commands, rules, hooks, MCP servers, and plugins from the surfaces in `@../references/ai-mapping.md`. A surface a tool does not have is skipped, never an error.
3. **Scan Context.** The memory bank under `aidd_docs/memory/` and whether its files are filled, any specs or plans under `aidd_docs/`, and whether the AI context files carry the `<aidd_project_memory>` block.
4. **Scan Codebase.** The stack, from the manifest or from the memory bank, and the few top-level modules or layers.
5. **Present the map.** One section per axis, each a short list or count with one-line purposes. No next-step advice, that belongs to the onboard skill.
6. **Offer to dig in.** Ask which axis the user wants in detail, and hand it to `02-drill`. Wait for the answer.

## Test

- The output has the three axes, each listing only what is actually present, with no invented item and no next-step recommendation.
