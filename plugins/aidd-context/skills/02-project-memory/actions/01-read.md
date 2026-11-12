# 01 - Read

Read the project and decide what the memory needs.

## Input

The project root, and the bank when one exists.

## Process

1. On a refresh, find the bank's last commit with `git log -1 --format=%H -- aidd_docs/memory`, then list what changed since with `git diff --stat <commit>`; with no such commit, read everything.
2. Read the project in the order of [reading sources](../references/reading-sources.md), the changed files first on a refresh.
3. Find its [capabilities](../references/capabilities.md) and its [outside tools](../references/ecosystem-signals.md).
4. On a refresh, review the bank per the [review protocol](../references/review-protocol.md).
5. List the files to create, the lines to add, and the bank lines to replace or remove with their reason.
6. If the list is empty and no tool is to be wired, say the bank is current and stop.
7. Send one message, numbered: each file to create; each bank line to replace or remove, quoted; each misplaced folder; each question the code cannot answer; the [tools](../references/tools.md) to wire.

## Output

The list of changes, and the person's answers.

## Rules

- Write no file.
- Only what the code cannot say becomes a question, at most eight.
- Read `ok` as yes to every numbered item, and `not 2` as no to that one.
