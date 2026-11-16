# 01 - Frame

Confirm the operation, the hosts and the rule it touches.

## Input

The request.

## Process

1. Confirm the operation: add, update, remove or publish.
   - Rename or drop a host: read the source in full.
   - Rename or drop a host: confirm a remove, then an add from that source.
2. Confirm the hosts per [hosts.md](../references/hosts.md).
   - Existing rule: reuse its `targets`.
   - Otherwise: detect the installed hosts, then ask, naming what each receives.
   - None detected: offer `codex`, a line in the root `AGENTS.md` index.
   - Index declined: stop, unsupported.
   - Publish: keep each source's own `targets`, adding hosts only when the user asks.
3. Confirm the rule.
   - New rule without a topic: ask for the topic.
   - Existing rule: name its source by category and slug.
   - Publish: every source, no topic.
4. Read [draft](02-draft.md) for add or update, or [plan](03-plan.md) for remove or publish.

## Output

The confirmed operation, hosts, and topic or source.
