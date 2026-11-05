# 03 - Check

Show what drifted in the bank, and let the user pick what to fix. Change nothing.

## Input

The bank in `aidd_docs/memory/`, and the capabilities the scan found.

## Output

Three blocks printed, Structure, Format and Content, then the question, and the findings the user approved. A file only on request.

## Process

1. **Structure.** Compare the bank against [capabilities.md](../references/capabilities.md).
   - A root file no row produces is the team's: keep it, unless a row's Former files names it, then offer to merge it into that row's file.
   - A row's file under `internal/` or a subfolder, or a folder under `memory/` other than `internal/` and `external/`: misplaced, offer to move it to the root, a folder under `internal/`.
   - A file of an always row, or of a found capability that got an answer, with nothing on disk: missing.
   - Offer to remove each file whose capability the scan did not find, and none when the scan asked nothing.
2. **Format.** Run `memory-lint.cjs` and keep its findings. No engine: apply the rule table of [memory-rules.md](../references/memory-rules.md).
3. **Content.** Have each memory file reviewed against [review-protocol.md](../references/review-protocol.md) in parallel.
4. **Print.** Print the three blocks in that order, then ask which findings to apply, and hand the approved ones to write.
   - Nothing drifted: call the bank current, hand nothing on.

## Test

| Case | Pass |
| --- | --- |
| Any run | no file changed or created; three blocks, then the question, no step named |
| Nothing drifted | nothing offered, the bank called current |
| Team file | a root file no row produces is not flagged, not offered for removal |
| Misplaced | flagged with the move offered, no root copy made |
| Former file | offered a merge into its row's file |
| Missing | an always file with nothing on disk is flagged; a conditional one with no answer is not |
| Contradiction, duplicate | flagged, the lines left in place |
| Removal declined | the file is still there |
