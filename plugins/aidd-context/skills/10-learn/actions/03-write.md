# 03 - Write

Write each validated row, then record the run.

## Input

The rows the user validated or modified, and those skipped.

## Process

1. Edit each existing-file row at its path with the host's native edit, anchored on its subject.
   - No file holds the subject: edit the memory bank file nearest to it.
   - Place it under the section that owns the subject, not after the last line.
2. Write each decision row with the writer, per [writer.md](../references/writer.md).
   - Row replaces a decision: pass the replaced record.
   - Section the source never states: ask the user for it, never infer it.
   - Writer exit non-zero: quote its output, then stop without a retry, a permission change or another write.
3. Hand each generation row to `aidd-context:03-context-generate`, one at a time, with its cited passage.
   - Generator done: continue at the next step, since its report does not end this run.
4. Append the run to `learn.md` from [learn-record.md](../assets/learn-record.md).
   - Every row goes in with its decision, skipped ones included.
   - Task named or clearly linked: use its folder.
   - No task: propose `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/learn.md` with a slug you pick, then ask to keep or decline it.
   - Record declined: the user's answer is the trace.
5. Read back each file written and check `learn.md` still holds its earlier passages.
6. Report by filling [report.md](../assets/report.md), its three lines and nothing else.

## Output

The files and decisions written, the generations handed over, and the record.

## Rules

- Append to `learn.md`, never overwrite it.
- Leave each decision file to the writer, never edit one by hand.
- End the turn with the filled report, nothing after it.
