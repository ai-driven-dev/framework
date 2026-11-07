# 01 - Scan

Read the project.

## Input

The project root.

## Process

1. **Ground.** Read the project against [reading-sources.md](../references/reading-sources.md); stop when it holds nothing to read.
2. **Find.** Detect the capabilities per [capabilities.md](../references/capabilities.md), each with its evidence.
3. **Map.** Detect the external tools per [ecosystem-signals.md](../references/ecosystem-signals.md), filling the `ecosystem` capability.
4. **Collect.** Unless the request is check, answer from the repository each slot of the files [capabilities.md](../references/capabilities.md) selects into [fact-sheet.md](../assets/fact-sheet.md), skipping a slot the bank answers. Write it to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_memory-<scope>/facts.md` (`<scope>` is setup or refresh), headed by the found capabilities as `C1 api, C2 auth`. On a refresh, first run `node memory.cjs changes .`, as [engine](../references/engine.md) says. Add its base and commit subject to the header. The brief's `Users`, `Main journey` and `Business rules` are answered only from what the repository states, else a `Q` line, never invented; a setup or an audit collects them, a refresh from a base never adds them.
5. **Next.** On a refresh or a check request read [check](03-check.md), else [write](02-write.md).

## Output

The fact sheet.

## Rules

- Write only the sheet.
