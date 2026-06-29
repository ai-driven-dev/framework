# 01 - Assert

Iterate the project's coding assertions until the work passes every one, fixing each failure.

## Input

The work to assert, named or described, from `$ARGUMENTS` or the context.

## Output

A pass or fail verdict: every applicable assertion passing in a final clean sweep, with the fixes applied listed.

## Process

1. **Enumerate.** List the assertions that apply, from the project conventions and `aidd_docs/memory/coding-assertions.md` when it exists.
2. **Iterate.** For each assertion, fix what blocks it, then re-run it until it passes.
3. **Sweep.** Once each has passed at least once, re-run them all in one pass to confirm none regressed.

## Test

- The final sweep passes every applicable assertion.
- The fixes listed cite real diffs, with no placeholder entries.
