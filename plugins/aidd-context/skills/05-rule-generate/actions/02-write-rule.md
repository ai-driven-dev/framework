# 02 - Write rule

Publish the approved result.

## Input

The approved capture.

## Output

The written files, or the refusal.

## Process

1. **Match.** For create/update, check body, fields, publication paths, resolution and evidence against the last approved capture; on any difference, return to capture-rule.
2. **Serialize.** For host create/update, write the JSON request outside the destinations per [publication](../references/rule-publication.md).
3. **Write.** Apply the approved result.
   - **Host.** Resolve the installed writer to an absolute path and reuse it for every call.
   - **Plugin.** Write or delete the approved source only.
4. **Report.** List the written files; on refusal, stop and quote it verbatim.

## Rules

- **Leave generated files to the writer.** Canonical metadata and generated outputs stay writer-owned, and legacy rules stay unchanged.
