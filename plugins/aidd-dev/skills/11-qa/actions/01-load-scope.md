# 01 - Load Scope

Load the planned QA scope and show it to the user before execution.

## Input

The feature folder or plan path.

## Output

A QA scope table with one happy path, planned edge cases, proposed edge cases, and expected outcomes.

## Process

1. **Resolve.** Find the feature folder, its plan, and its phase files.
2. **Read.** Extract the happy path and edge cases from the test scope. Read the user journey and acceptance criteria only to resolve their expected outcomes.
3. **Propose.** Identify additional observable edge cases from untested boundaries or failures in the planned behavior. Label each as proposed and name its source.
4. **Show.** Display one table covering the happy path and every edge case. Ask the user to confirm the scenarios that will run.
5. **Stop.** Return a scope gap when the plan has no ordered happy path with expected outcomes. Never invent execution steps.

## Test

- The QA scope contains one ordered happy path and zero or more named edge cases with expected outcomes.
