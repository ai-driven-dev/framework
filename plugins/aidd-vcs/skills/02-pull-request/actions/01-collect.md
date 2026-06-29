# 01 - Collect

Resolve the base branch and gather the change to describe.

## Input

An optional base branch, overriding the resolved one.

## Output

The VCS tool, the head and base branches, and the commits and changed files since the base.

## Process

1. **Tool.** Use the VCS tool from project memory, else infer it from the remote URL.
2. **Base.** Use a provided base. Otherwise resolve it from the head branch's prefix (project memory, e.g. `feat/` → `next`), else the repo's default branch. Surface the base and why.
3. **Gather.** Summarize the commits and changed files since the base.

## Test

- The resolved base matches the branch prefix when one maps, not a blind `main`.
- The summary reflects the commits between base and head.
