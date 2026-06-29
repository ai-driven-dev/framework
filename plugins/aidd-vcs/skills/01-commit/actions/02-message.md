# 02 - Message

Write the commit message for the staged change.

## Input

The staged set from `01-collect`, and an optional imposed message.

## Output

The commit message, conventional unless the project sets another convention.

## Process

1. **Source.** Use an imposed message as-is. Otherwise follow `aidd_docs/memory/vcs.md` when set, else `@../assets/commit-template.md`.
2. **Write.** Draft from the staged diff: imperative subject, a body that says why when it is not obvious.
3. **Confirm.** In `interactive`, show it and wait for approval. In `auto`, proceed.

## Test

- The subject matches the project's convention (conventional commit by default).
- The message describes the staged change, not unrelated files.
