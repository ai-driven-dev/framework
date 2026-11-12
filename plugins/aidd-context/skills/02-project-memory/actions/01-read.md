# 01 - Read

Read the project and decide what the memory needs.

## Input

The project root, and the bank when one exists.

## Process

1. From the project root, run the skill's `scripts/project-memory.cjs changes` with node: the bank's last commit, the files changed since, each misplaced folder. No bank commit means a setup, else a refresh.
2. Read the project in the order of [reading sources](../references/reading-sources.md), the changed files first on a refresh.
3. Find its [capabilities](../references/capabilities.md) and its [outside tools](../references/ecosystem-signals.md).
4. On a refresh, review the bank per the [review protocol](../references/review-protocol.md).
5. List the files to create, the lines to add, and the bank lines to replace or remove with their reason.
6. If the list is empty and no tool is to be wired, say the bank is current and stop.
7. Send one message, opened by one line: what is stale, what is to wire. Then number the items: each file to create, each misplaced folder, each [tool](../references/tools.md) to wire, each bank line to change.
8. Show a bank line to change under its file name: a `- ` line quoting it exactly, a `+ ` line with its new text unless removed, its reason in a few words.
9. Put the questions the code cannot answer apart, after the items, as `Q1`, `Q2`.
10. End with how to answer: `ok`, or `not 2`.

## Output

The list of changes, and the person's answers.

## Rules

- Write no file.
- Only what the code cannot say becomes a question, at most eight.
- Read `ok` as yes to every numbered item, and `not 2` as no to that one; `ok` never answers a question, ask it again.
