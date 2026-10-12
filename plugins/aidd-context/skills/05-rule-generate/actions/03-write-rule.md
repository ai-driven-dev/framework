# 03 - Write rule

## Input

Approved candidates and source changes, or confirmed publish/delete selection.

## Output

Affected sources, publications and refusals.

## Process

1. **Prepare.** Carry the exact approved bodies and metadata without regeneration.
   - For host create/update, prepare the JSON request through [tool-paths.md](../references/tool-paths.md).
   - Publish/delete needs no candidate request.
2. **Write.** Execute the confirmed mode and operations from `tool-paths.md`.
   - Apply only approved source changes, including merge/replacement deletions.
   - Report script refusals verbatim.
