# 01 - Test

Identify untested behaviors in the target, then write and iterate tests until they pass with modern testing practices.

## Input

The scope to cover, a feature, module, or file glob, from `$ARGUMENTS`.

## Output

The behaviors found and, per behavior, a passing test with its file path, or a `pending` entry with a one-line reason when deliberately skipped.

## Process

1. **List.** Enumerate the untested behaviors in the target area. Reason from the existing ones, score each from 0 (not needed) to 5 (critical core flow), group by section, prioritize by score and impact, and show a minimal bullet list.
2. **Approve.** Wait for user approval before generating any test.
3. **Generate.** Write the initial test for the highest-priority behavior, applying current testing practices and project conventions.
4. **Iterate.** Run the test. On failure, analyze it, improve the test, and repeat. On pass, check it against the quality criteria and improve when it falls short.
5. **Next.** Move to the next behavior and repeat from Generate until the list is exhausted.
6. **Boundary.** One test at a time, functional behavior only. Never compromise quality for speed.

## Test

- Every behavior in the approved list has a corresponding test in the project suite that passes, with its file path recorded.
- Each deliberately skipped behavior has a `pending` entry with a one-line reason.
