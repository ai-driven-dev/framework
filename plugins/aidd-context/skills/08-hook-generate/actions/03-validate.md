# 03 - Validate

Check plugin guidance and every written declarative hook against its own contract.

## Input

The list of paths touched and plugin guidance (from 02), including an empty path list and the before-state from action 01 for guidance-only requests.

## Output

A short pass or fail line per tool, plus the script.

## Process

1. **Guidance.** For each OpenCode or Kilo target, confirm the guidance cites its official source and a documented event or explicit unsupported limit. For a guidance-only request, compare the complete project tree before and after: no write. For mixed requests, confirm no plugin-only hook, config, script, or plugin was added.
2. **Parse.** Confirm each written declarative target file still parses in its format and the entry sits at the right key for its scope.
3. **Moment.** For each declarative publication, confirm the event's documented semantic equivalence, timing, payload and matcher against the requested moment ([hook-authoring.md](../references/hook-authoring.md), [tool-paths.md](../references/tool-paths.md)). A merely nearby event is not an equivalent. Confirm skipped targets have no published artifact.
4. **Blocking.** If the hook blocks, confirm the documented event and tool can block at that moment ([tool-paths.md](../references/tool-paths.md)).
5. **Script.** For a script-backed handler, confirm the script exists, is executable, and reads stdin and signals per the contract.
6. **Relance.** For declarative targets, execute a second pass with identical inputs: config and script bytes and mtimes must be identical; user entries, including duplicates, remain untouched. Test an invalid final target in mixed fan-out and confirm the full tree has no new files or changed bytes. For guidance-only requests, the tree comparison in step 1 is the no-write check.

## Test

- Each written declarative target file parses with the entry under the correct key.
- Each published event matches the target tool's moment, and any blocking hook sits on a moment that can block.
- A second declarative pass is byte-identical and leaves user hooks intact; invalid input fails before any write.
- OpenCode-only and Kilo-only requests run this action, cite supported events or unsupported limits, and leave the project tree unchanged.
- A mixed request preserves declarative validation and publishes nothing for unsupported or plugin-only targets.
