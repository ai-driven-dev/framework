# 03 - Validate

Check Kilo guidance and every written declarative hook against its own contract.

## Input

The list of paths touched (from 02).

## Output

A short pass or fail line per tool, plus the script.

## Process

1. **Kilo.** Confirm the guidance cites the official source and documented event or unsupported limit, and compare the full project tree before and after a Kilo-only request: no write. For mixed requests, confirm no Kilo hook/config/plugin was added.
2. **Parse.** Confirm each non-Kilo target file still parses in its format and the entry sits at the right key for its scope.
3. **Moment.** Confirm the event name is the right one for that tool's moment, and the matcher is well-formed ([tool-paths.md](../references/tool-paths.md)).
4. **Blocking.** If the hook blocks, confirm the moment can block on that tool ([tool-paths.md](../references/tool-paths.md)).
5. **Script.** For a script-backed handler, confirm the script exists, is executable, and reads stdin and signals per the contract.
6. **Relance.** Execute a second pass with identical inputs: config and script bytes and mtimes must be identical; user entries, including duplicates, remain untouched. Test an invalid final target in mixed fan-out and confirm the full tree has no new files or changed bytes.

## Test

- Each target file parses with the entry under the correct key.
- Each event name matches the tool's moment, and any blocking hook sits on a moment that can block.
- The second pass is byte-identical and leaves user hooks intact; invalid input fails before any write.
