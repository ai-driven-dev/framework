# 02 - Write rule

Write the approved result and verify it.

## Input

Approval: a user message approving the last displayed candidate unchanged.

Capture: the approved capture and its request.

## Output

The written files, verified, or the refusal.

## Process

1. Match: for create/update, require that approval and compare body, fields, paths, resolution and evidence with the approved candidate. Without approval or on any difference, return to capture-rule, present the revision, end the turn, write nothing.
2. Write the approved result.
   - Host: run the writer by the absolute path resolved in capture-rule, with the approved request. For Kilo, pass the confirmed `--kilo-config` path when one was selected.
   - If Kilo is among the publications and `paths` is nonempty, stop on the writer's refusal. The writer guarantees no canonical, native or configuration mutation; do not retry with a partial fan-out.
   - Plugin: write or delete the approved source only.
3. Verify: for a host, run the same absolute writer with `--check --publish` and the same confirmed targets/configuration. Require no drift, deletions included.
4. Report the written files. On refusal or drift, stop and quote it verbatim.

## Rules

- Leave generated files to the writer: canonical metadata and outputs are writer-owned, legacy rules unchanged.
- Claim consumption only with matching and nonmatching file evidence from fresh host sessions.
