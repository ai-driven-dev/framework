# 04 - Validate

## Input

Affected files and approved resolution.

## Output

One pass/fail result per affected rule.

## Process

1. **Operation.** Confirm expected sources/publications exist, or selected deletions are absent.
   - Remaining rules and user bytes must survive.
2. **Content.** Check [rule-authoring.md](../references/rule-authoring.md), exact approved body, scope, destinations and resolution.
3. **Publication.** Check [tool-paths.md](../references/tool-paths.md), including native syntax, shared-body uniqueness, last-rule cleanup, memory preservation and byte-idempotent republishing.
4. **Report.** Separate publication from runtime consumption; only actual host evidence proves consumption.
