# 03 - Check

Find what drifted in the bank.

## Input

The bank and the scan's capabilities.

## Output

The findings the user approved.

## Process

1. **Structure.** Compare the bank against [capabilities.md](../references/capabilities.md).
   - A root file no row produces is the team's: keep it, unless a row's Former files names it.
   - A file a row produces, found in `internal/` or a subfolder: misplaced, offer to move it to the root.
   - A folder under `memory/` other than `internal/` and `external/`: offer to move it under `internal/`.
   - An always file, or a found capability's file, that is absent: missing.
   - Offer to remove a file a row produces whose capability the scan did not find, and none when the scan asked nothing.
2. **Format.** Run the engine on the files a row produces, never a team file.
3. **Content.** Have each memory file reviewed against [review-protocol.md](../references/review-protocol.md) in parallel.
4. **Print.** Print Structure findings, Format findings and Content findings in that order, each headed, no table, one finding per line. Then ask which to apply, and hand the approved ones to write.
   - A file only on request.
   - Nothing drifted: say the bank is current.

## Test

| Case | Pass |
| --- | --- |
| Any run | no file changed or created, no step named |
| Team file | not flagged, not linted, not offered for removal |
| Misplaced | flagged, move offered, no root copy |
| Former file | offered a merge into its row's file |
| Missing | an absent always file is flagged |
| Contradiction, duplicate | flagged, lines left in place |
| Removal declined | the file stays |
