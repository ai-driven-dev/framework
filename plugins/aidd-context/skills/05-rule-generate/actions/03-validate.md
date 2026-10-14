# 03 - Validate

## Input

Approved capture; write results.

## Output

Per-rule pass/fail reasons.

## Process

1. Check reported existence/deletion.
2. Match approved fields and host schemas against [authoring](../references/rule-authoring.md) and [publication](../references/rule-publication.md).
3. Affected shared publications only: check signed uniqueness and last-rule cleanup. Verify survivors, user guidance and memory bytes.
4. Hosts: repeat approved publication; require identical bytes.

## Rules

- Consumption requires matching/nonmatching file evidence in fresh host sessions.
