# 03 - Validate

## Input

Approved capture and write results.

## Output

Explained pass/fail per affected rule.

## Process

1. **Operation.** Check expected existence/deletion against reported files.
2. **Contract.** Check approved bodies, metadata and scope against [rule-authoring.md](../references/rule-authoring.md); targets and host schemas against [tool-paths.md](../references/tool-paths.md).
3. **Preservation.** For affected shared publications, check signed uniqueness and last-rule cleanup. Verify surviving rules, user guidance and memory bytes.
4. **Repeat.** Hosts: repeat approved publication; require byte-identical results.

## Rules

- Publication does not prove runtime consumption; only matching/nonmatching file evidence in fresh host sessions does.
