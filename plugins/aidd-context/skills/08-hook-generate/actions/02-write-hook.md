# 02 - Write hook

Return plugin guidance and write only confirmed declarative targets after preflighting the entire fan-out.

## Input

From 01: the moment, action, script need, matcher, confirmed tools, and any declarative scope and write mode. Carry the guidance-only before-state through to action 03.

## Output

The updated declarative target file per tool, any script written, the list of paths touched, and separate plugin guidance.

## Process

1. **Guidance.** Return sourced OpenCode or Kilo plugin guidance from action 01, including an unsupported event limit where applicable. Report it separately from written targets in a mixed fan-out. Do not generate a script, plugin, or config for either plugin-only tool.
2. **Preflight.** Before any script or config write, resolve every selected declarative destination. Exclude targets without a documented equivalent event or required properties; they receive no hook or backing script. Read and parse each remaining config in its own format, validate the event list/entry shape and every existing handler needed for the merge, and reject an invalid entry, collision, symlink escape, unsafe script path or unwritable target. Stage the intended entry and handler bytes in memory. If any target is invalid, abort before any write; report the failing path and leave all targets unchanged. A guidance-only request writes nothing and continues to action 03.
3. **Script.** If the action needs a backing script ([hook-authoring.md](../references/hook-authoring.md)): copy [hook-script-template.sh](../assets/hook-script-template.sh), fill the logic, place it in the scope's script directory ([tool-paths.md](../references/tool-paths.md)), and make it executable. One script can back every declarative tool. Reuse an existing byte-identical AIDD script without rewriting it; do not overwrite user content.
4. **Entry.** Per confirmed declarative tool, fill [hook-template.json](../assets/hook-template.json) from [tool-paths.md](../references/tool-paths.md), using that tool's shape and stripping the scaffold.
   - Point the handler at the script by absolute path or an approved `${VAR}`.
5. **Merge.** For each tool, append only when that exact AIDD entry is absent from the chosen event list. Compare the full entry, including matcher and handler command, not just the event name. Preserve existing order, every user hook and user duplicate, and pre-existing AIDD duplicates. Never normalize or remove prior entries. Skip byte-identical writes on a second pass.
6. **Validate.** Run the merge check and write-target validation ([tool-paths.md](../references/tool-paths.md)).

## Test

- Each target file is valid after the merge.
- The new entry is present in each, and every prior sibling survives.
- A script-backed handler's script exists at its path and is executable.
- A second identical pass leaves config/script bytes and mtimes unchanged; user hooks and duplicates survive.
- An invalid last target aborts before any write to an earlier target.
- A target with an absent or merely nearby non-equivalent event has no hook, script, or config published for it; confirmed declarative targets in a mixed request remain eligible.
