# 01 - Scan

Read the project.

## Input

The project root.

## Output

The confirmed capabilities, printed nowhere.

## Process

1. **Ground.** Memory records what exists. Find what there is to record: source code, an `INSTALL.md`, or a PRD or spec under `aidd_docs/`.
   - None of them: stop, and say the project has nothing to remember yet.
   - Point at `aidd-context:01-bootstrap` to choose a stack, or `aidd-pm:03-prd` to state what the project is.
2. **Detect.** Find the project's capabilities per `@../references/capability-signals.md`, each with its repo evidence.
3. **Confirm.** Show each with its evidence. Let the user add or drop one. Block on the answer.
4. **Hold.** Keep the confirmed capabilities in context.

## Test

- Scan writes no file.
- An empty project stops at Ground, named a real command, and generated nothing.
- Every shown capability carries the repo fact that fired it.
- Scan never asks about AI tools. Sync does, when the answer is used.
