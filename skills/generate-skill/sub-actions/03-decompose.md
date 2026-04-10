# SA-03: Decompose into sub-actions

Break the workflow down into atomic, testable sub-actions.

## Instructions

1. For each step in the workflow, apply the atomicity test: "Can a sub-agent run this with only the sub-action file, the referenced documentation, and an input payload — and can success be verified with one assertion?"
2. If a step fails the atomicity test, decompose it further.
3. Assign two-digit sequence numbers. Same number = parallel execution.
4. For each sub-action, define:
   - A clear name (verb + object)
   - The goal (what it accomplishes)
   - The validation condition (how to know it's done)
5. Identify which references each sub-action needs.

## Input / Output

- **Input**: Complete workflow description from step 02.
- **Output**: Ordered list of sub-actions with names, goals, validation conditions, and reference dependencies.

## References

- Read `references/sub-action-template.md` for the atomicity test and sub-action structure.

## Test policy

- **Assertion**: Every sub-action in the list passes the atomicity test.
- **Exit condition**: A numbered list of sub-actions exists, each with a name, goal, validation condition, and reference dependencies.
- **Expected result**: `[{ number, name, goal, validation, references }]`
- **Retry loop**: If a sub-action is too large, split it. Loop until all pass atomicity. Hard stop after 3 attempts on the same action: flag it as a complex action and proceed.
- **On failure**: Report which actions fail the atomicity test and ask the user if they can be simplified.
