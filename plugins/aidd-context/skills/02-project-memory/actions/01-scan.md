# 01 - Scan

Read the project.

## Input

The project root.

## Output

The confirmed capabilities, printed nowhere.

## Process

1. **Ground.** Memory records what exists. Find something to record: source code, or anything written that says what the project is.
   - Neither: stop, and say the project has nothing to remember yet.
   - Send the user to decide a stack or write down what the project is, then come back.
2. **Detect.** Find the project's capabilities per `@../references/capability-signals.md`, each with its repo evidence.
3. **Confirm.** Show each with its evidence. Let the user add or drop one. Block on the answer.
4. **Hold.** Keep the confirmed capabilities in context.

## Test

- `git status` lists nothing new.
- On a project with no code and nothing written about it, `aidd_docs/` does not exist.
- Each capability shown names the file or dependency that fired it.
