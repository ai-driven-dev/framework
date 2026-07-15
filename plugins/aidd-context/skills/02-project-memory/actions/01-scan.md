# 01 - Scan

Read the project.

## Input

The project root.

## Output

The confirmed capabilities, printed nowhere.

## Process

1. **Ground.** Look for something to remember: source code, or anything written about what the project is.
   - Nothing there: stop, say so, send the user to create something first.
2. **Find.** Detect the project's capabilities per `@../references/capability-signals.md`, each with its repo evidence.
3. **Ask.** Show each capability with its evidence. Ask the user to add or drop one. Wait for the answer.
4. **Confirm.** Keep the confirmed set in context for generate.

## Test

- The run changes no file: `git status --porcelain` reads the same after as before.
- A capability reaches the confirmed set only when a file or dependency for it exists in the repo.
- On a repo with no code and nothing describing it, the run stops at Ground and hands nothing to generate.
