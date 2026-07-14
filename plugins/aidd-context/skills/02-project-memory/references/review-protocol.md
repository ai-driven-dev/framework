# Review protocol

Generated memory is reviewed by readers who did not write it. A writer cannot judge its own omissions.

## Fan out

- One reviewer per memory file, run in parallel.
- Each reviewer reads the file, the codebase it claims to describe, and the other memory files' names.
- A reviewer is an agent that did not write what it reads. Prefer a checker agent when the project has one.

## What each reviewer returns

- Every breach of `memory-rules.md`, the rules the file was written against.
- Every claim the code does not back.

## Settle

- Apply a fix that is safe and unambiguous.
- Flag the rest with a reason a human can act on.
- Duplication: keep the fact in its home file, drop the copy.

## No subagents

A host without subagents runs one review pass per file in a fresh read, one file at a time, never carrying the writing context forward. Say in the report that the review ran without independent reviewers.
