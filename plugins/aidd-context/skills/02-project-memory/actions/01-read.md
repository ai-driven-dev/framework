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
8. Head each bank change with its number and file, then a `diff` block: `- ` lines quoting the bank lines exactly, `+ ` lines with the new text. Its reason follows in a few words.
9. For a file to remove, the block quotes every line of it.
10. Put the questions the code cannot answer apart, after the items, as `Q1`, `Q2`.
11. If choices remain, end with how to answer them: `ok` approves undecided numbered items, or `not 2` rejects item 2. Ask for a reply only for those remaining choices.
12. When all choices are settled, continue to [write](02-write.md) without waiting for another reply.

## Output

The list of changes, and the person's answers.

## Rules

- Write no file.
- Use the person's exact words for choices and answers; never invent an answer.
- Ask only unresolved material choices the repo cannot answer, at most eight.
- Reuse an explicit answer to the same proposed edit; do not ask it again. A prior no remains no unless the person explicitly reverses it.
- General approval before a proposal answers no unknown choice and does not approve a replacement or removal.
- Read `ok` as yes to each undecided numbered item, and `not 2` as no to item 2; `ok` never answers a question.
