# 03 - Check

Find what drifted in the bank.

## Input

The bank and the scan's capabilities.

## Process

1. **Content.** Take the output of `changes`, running `node memory.cjs changes .` first when the request is check, as [engine](../references/engine.md) says. Review per [review-protocol.md](../references/review-protocol.md): scope update, only the lines and files it names; scope audit, the files a row produces or lists under Accepted names, one at a time, against the files that define its facts.
2. **Format.** Last of the reading, run the engine's whole-bank check once, `node memory.cjs check .`, as [engine](../references/engine.md) says. Its errors on the files a row produces or lists under Accepted names become findings, never a team file's; count its warnings and do not investigate them.
3. **Structure.** Take that run's structure findings; judge none.
   - A root file no row produces is the team's: keep it.
   - A root file in a row's Accepted names column: keep it as that row's file and offer nothing on it.
   - A file a row produces found in `internal/` or a subfolder, or a folder under `memory/` other than `internal/` and `external/`: misplaced, report it as a `move <path> to <path>` finding and move nothing.
   - Never offer to remove a file.
4. **Report.** On a refresh ask nothing and go on to [write](02-write.md): every finding is an unanswered `D` line of the sheet; a changed or removed line starts `remove` or `replace`, a misplaced file is `move <path> to <path>`, any other finding is an addition. On a check request print three blocks headed `Structure findings`, `Format findings`, `Content findings`, no table, one finding per line, and change nothing.
   - Nothing drifted: say the bank is current.

## Output

D lines added to the sheet; on a check request, the printed report.

## Rules

- Change no memory file.
