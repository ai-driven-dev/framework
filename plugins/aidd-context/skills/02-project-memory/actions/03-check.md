# 03 - Check

Show what drifted in the bank and select findings within the authorized scope. Change no memory files.

## Input

The bank in `aidd_docs/memory/`, and the capabilities the scan found.

## Output

A report file under `aidd_docs/tasks/`, a short summary printed, and findings within the authorized scope.

## Process

1. **Match.** Compare the bank against [memory-destinations.md](../references/memory-destinations.md) and [structure.md](../references/structure.md).
   - A file no row produces: flag it, and name the row it should have come from.
   - A found capability, or a scaffolded path, with nothing on disk: flag it missing.
2. **Review.** Have the memory files independently reviewed against [review-protocol.md](../references/review-protocol.md). Group related files and parallelize only when worthwhile.
3. **Prune.** Flag files whose capability the scan did not find; absence from the scan alone does not justify removal.
   - For `browsing.md`, an undetected browser tool is not evidence that the project stopped using it. Do not offer removal unless the user confirms it is no longer needed.
4. **Report.** Fill [report.md](../assets/report.md), write it to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_memory-check/report.md`, and print the summary with that path.
   - The folder already holds a report: replace it only if authorized; otherwise choose an unused path.
5. **Select.** Hand findings within the authorized scope to write. Ask which to apply only when the scope is materially unclear.
   - Nothing drifted: call the bank current, hand nothing on.

## Test

| Case | Pass |
| --- | --- |
| Any run | no file under `aidd_docs/memory/` changed |
| Any finding | the summary holds no table and names the report path |
| Nothing drifted | nothing offered, the bank called current |
| Report | structural gaps and reviewer findings under separate headings |
| Report | no step of this skill named in it |
| Orphan | flagged, with the row it should have come from |
| Missing | a found capability with no file is flagged |
| Contradiction | flagged, the line left in place |
| Duplicate | flagged, both files left as they are |
| Removal declined | the file is still there |
| Browser tool unavailable | browsing memory is not proposed for removal without confirmation that it is no longer needed |
