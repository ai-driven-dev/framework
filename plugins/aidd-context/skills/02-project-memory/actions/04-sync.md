# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Output

Each picked tool's context file, carrying the filled block.

## Process

1. **Require.** Stop unless `aidd_docs/memory/` holds a `.md`, sending the user to write the memory first.
2. **Detect.** Find the AI tools present per [tools.md](../references/tools.md).
3. **Pick.** Show every tool, the detected ones ticked, and wait for one or several.
4. **Preflight.** From the user's project root, resolve and deduplicate every picked destination per [tools.md](../references/tools.md), including the bank README when it opts into `files` markers. Inspect the complete set against its [explicit sync safety contract](../references/tools.md#explicit-sync-safety) before any creation or mutation. Stop without changing files if a destination, marker pair, ancestor, or write condition is invalid, ambiguous, or cannot be verified. Never infer a hook installation path from the project root or the active skill's location.
5. **Upsert.** Ensure each picked tool's context file carries the block, per [tools.md](../references/tools.md).
   - Absent file: create it from [AGENTS.md](../assets/templates/AGENTS.md).
   - Its AIDD structure differs: offer to reconcile it, applying only what the user approves.
6. **Fill.** Reinspect the complete selected set and opted-in README immediately before filling. Stop before filling if anything fails preflight. In each deduplicated context block, list sorted root `.md` files except `README.md`; list `.md` files under `internal/` and `external/` as plain read-on-demand paths, never imports. Use Claude `@` imports and relative Markdown links for the root files in other tools. Refresh the opted-in README `files` block with links relative to that README. Preserve all bytes outside owned blocks, including line endings. Leave unselected files untouched, skip byte-identical writes, and do not stage or add files to Git.
7. **Verify.** Read each picked tool's block and the opted-in README `files` block back and compare them to the bank.
   - A file in one and not the other: the fill did not land, report it and stop.

This manual workflow does not establish the hook's protection against path substitution or multiple hard links. If a hardlink, a changing path, or any other condition requires a guarantee the manual checks cannot demonstrate, stop the sync and explain that safe hook resolution remains an AIDD-P11 evolution. The automatic hook keeps its existing best-effort behavior; this explicit sync must refuse detected problems before writing.

## Test

| Case | Pass |
| --- | --- |
| Empty bank | no context file created, the run stops |
| Unsafe or unverifiable path | no file changes; explain the AIDD-P11 limit when hook-level protection is required |
| Picked tool | its block lists every root `.md` except `README.md`, nothing else |
| Bank grew | the block gains that file and keeps the rest |
| Unpicked tool | its context file is unchanged |
| Invalid last destination or opted-in README | preflight refuses before any context creation or modification |
| Shared destination | picked tools resolving to `AGENTS.md` produce one block and one write |
| Identical rerun | every context file remains byte-identical |
