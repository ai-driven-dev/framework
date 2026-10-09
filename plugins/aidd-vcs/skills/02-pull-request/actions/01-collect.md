# 01 - Collect

Resolve the base branch and gather the change to describe.

## Input

An optional base branch, overriding the resolved one.

## Output

The VCS tool, the head and base branches, the commits and diff since the base, the changed observable behaviors, and their available validation evidence.

## Process

1. **Tool.** Use the VCS tool from project memory, else infer it from the remote URL.
2. **Base.** Use a provided base, else resolve it per the project's branch convention, else the repo's default branch. Surface the base and why.
3. **Read.** Read the diff against the resolved base.
4. **Identify.** Identify the observable behaviors changed by the diff.
5. **Evidence.** Collect available validation evidence for those behaviors.

## Test

- The resolved base matches the branch prefix when one maps, not a blind `main`.
- The changed behaviors reflect the diff between base and head.
