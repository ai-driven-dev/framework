# 04 - Validate

Review the written skill against the contract and fix what breaks.

## Input

The skill written by 03.

## Output

A report, one row per file: what was checked and any fix applied.

## Process

1. **Review.** Review each file against `@../references/review-protocol.md`.
2. **Fix.** Apply the confirmed fixes on disk, then re-review the changed files.
3. **Report.** Deliver the findings, even when clean.

## Test

- The report covers every file, each with its findings or none.
- No file breaches `@../references/skill-authoring.md`.
- Any file changed by a fix differs on disk.
