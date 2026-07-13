# 01 - Scan

Read the project, take the user's pick.

## Input

The project root.

## Output

The confirmed tools and capabilities, printed nowhere.

## Process

1. **Tools.** Detect the AI tools present per `@../references/tools.md`.
2. **Pick.** Show the detected tools. Let the user pick one or several. Wait for the pick, never default to all.
3. **Capabilities.** Detect the project's capabilities per `@../references/capability-signals.md`, each with its repo evidence.
4. **Confirm.** Show each capability with its evidence. Let the user add or drop one. Block on the answer.
5. **Hold.** Keep the confirmed tools and capabilities in context.

## Test

- Scan writes no file.
- A tool is offered only when a signal detects it.
- No tool is picked without the user saying so.
- Every shown capability carries the repo fact that fired it.
