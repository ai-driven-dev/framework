# 01 - Frame

Confirm the operation, the hosts and the rule it touches.

## Input

The request.

## Process

1. Confirm the operation: add, update, remove or publish.
2. Confirm the hosts per [hosts.md](../references/hosts.md).
   - Existing rule: reuse its `targets`.
   - Otherwise: detect the installed hosts, then ask.
   - No supported host: report the alternatives and stop, unsupported.
3. Confirm the rule: ask for the topic when the request lacks one, or name the existing source by category and slug.
   - Publish: every source, no topic.
4. Read [draft](02-draft.md) for add or update, or [plan](03-plan.md) for remove or publish.

## Output

The confirmed operation, hosts, and topic or source.
