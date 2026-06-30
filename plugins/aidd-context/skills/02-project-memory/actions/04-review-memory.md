# 04 - Review memory

Review every memory file together for cross-file consistency and duplication, fixing what is safe.

## Input

The `aidd_docs/memory/` directory with the generated files.

## Output

The memory files, corrected in place where safe, and a status report.

## Process

1. **Read.** Load every `.md` under `aidd_docs/memory/`, recursively.
2. **Review.** In one pass, check cross-file consistency and accuracy. Fix a safe issue in place, flag one that needs a human.
3. **Deduplicate.** Keep each fact in one file, drop the copies (judge by meaning, not wording). May be handed to an independent checker subagent.

## Test

- Every memory file is covered by the report, each flagged file with a reason a human can act on.
- No fact's definition is duplicated across files.
