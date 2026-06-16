# 04 - Review memory

Review every memory file together for cross-file consistency, and fix what is safe.

## Input

The `aidd_docs/memory/` directory with the generated files.

## Output

The memory files, corrected in place where needed, and a status table.

## Process

1. **Read.** Load every `.md` under `aidd_docs/memory/`, recursively.
2. **Review.** In one pass with all files in context, check consistency and accuracy across them. Fix a safe inconsistency in place. Flag one that needs a human.
3. **Report.** A table: file, status (clean, fixed with reason, or needs review).

## Test

- The status table covers every memory file, and each flagged file carries a reason a human can act on.
