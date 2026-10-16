# 02 - Write rule

Publish the approved result and verify it.

## Input

The approved capture and its request.

## Output

The written files, verified, or the refusal.

## Process

1. **Match.** For create/update, check body, fields, publication paths, resolution and evidence against the last approved capture; on any difference, return to capture-rule, present the revision and await approval before writing.
2. **Write.** Apply the approved result.
   - **Host.** Run the writer by the absolute path resolved in capture-rule, never `$PWD`-relative, with the approved request.
   - **Plugin.** Write or delete the approved source only.
3. **Verify.** For a host, run that same absolute writer with `--check --publish`; require no drift, also after a deletion.
4. **Report.** List the written files; on refusal or drift, stop and quote it verbatim.

## Rules

- **Leave generated files to the writer.** Canonical metadata and generated outputs stay writer-owned, and legacy rules stay unchanged.
- **Claim consumption** only with matching and nonmatching file evidence from fresh host sessions.
