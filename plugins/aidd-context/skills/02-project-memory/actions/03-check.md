# 03 - Check

Find what drifted in the bank.

## Input

The bank and the scan's capabilities.

## Output

D lines added to the sheet; on a check request, the printed report.

## Process

1. **Content.** Review the files a row produces or lists under Accepted names one at a time, each against the files that define its facts, per [review-protocol.md](../references/review-protocol.md).
2. **Format.** Last of the reading, run the engine's whole-bank check once. Errors on the files a row produces or lists under Accepted names become findings, never a team file's; count its warnings in the report and do not investigate them.
3. **Structure.** Take the structure findings of that run against [capabilities.md](../references/capabilities.md), never judge them.
   - A root file no row produces is the team's: keep it.
   - A root file in a row's Accepted names column: keep it as that row's file and offer nothing on it.
   - A file a row produces found in `internal/` or a subfolder, or a folder under `memory/` other than `internal/` and `external/`: misplaced, report it as a `move <path> to <path>` finding and move nothing.
   - Never offer to remove a file.
4. **Report.** On a refresh ask nothing: every finding becomes an unanswered `D` line of the sheet, a changed or removed line starts `remove` or `replace`, a misplaced file is `move <path> to <path>`, any other finding is a plain addition. On a check request print three blocks headed `Structure findings`, `Format findings`, `Content findings`, no table, one finding per line, and change nothing.
   - A file only on request.
   - Nothing drifted: say the bank is current.

## Test

| Case | Pass |
| --- | --- |
| Any run | no memory file changed, no step named |
| Contradiction, duplicate | flagged, lines left in place |
