# 01 - Test

Identify untested behaviors in the feature, then create and iterate on tests until they pass with modern testing best practices.

## Inputs

```yaml
scope: <feature, module, or file glob>   # passed via $ARGUMENTS
```

## Outputs

```yaml
behaviors_listed: <int>
tests_added: <int>
tests_passing: <int>
report:
  - { behavior: <name>, status: pass, file: <test path> }
  - { behavior: <name>, status: pending, reason: <why> }
```

## Process

1. **List untested behaviors** in the target area:
   - Think about behaviors based on existing ones.
   - Score each from 0 (not needed) to 5 (critical core flow).
   - Group by distinct sections.
   - Prioritize by score and impact.
   - Display as an organized minimal bullet list.
2. **Wait for user approval** before generating any test.
3. **Generate the initial test** for the highest-priority behavior, applying current testing best practices and project conventions.
4. **Run, observe, iterate.** If the test fails, analyze the failure, improve the test, repeat. If it passes, validate against the quality checklist; improve if quality is insufficient.
5. **Move to the next behavior** and repeat from step 3 until the list is exhausted.
6. **Boundaries.** Focus on ONE test at a time. Never compromise quality for speed. Functional aspects only; ignore implementation details.

## Test

For every behavior in the approved list: a corresponding test exists in the project test suite, the test passes, and the report records the test file path. Behaviors that are deliberately skipped have a `pending` entry with a one-line reason.
