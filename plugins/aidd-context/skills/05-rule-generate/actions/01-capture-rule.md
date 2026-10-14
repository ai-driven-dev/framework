# 01 - Capture rule

## Input

Topic, `auto`, or publish/delete; default manual.

## Output

Approved candidates or confirmed sources, operation and destinations.

## Process

1. **Confirm destination.** Confirm operation, hosts or plugin per [tool-paths.md](../references/tool-paths.md). Missing hosts: detect/propose installations; await selection before drafting/assessment.
2. **Select.** Manual: ask for missing topic. Auto: scan/propose topics; await selection. Publish/delete: confirm identified sources and affected publications, including the whole publish set; continue to Write without drafting/assessment.
3. **Draft.** Create/update: confirm topic, category/slug, description, scope per [rule-authoring.md](../references/rule-authoring.md); draft complete candidates with [rule-template.md](../assets/rule-template.md).
4. **Assess.** Apply Discovery in tool-paths; compare obligations, prohibitions, scopes, conditions, exceptions and priority, including prior sources and future files; apply Assessment. Exclude only proven disjoint scopes.
5. **Decide.** Show full candidates and findings: sources, decisive text, scope reasons; offer create/keep/update/merge/scope/priority/cancel choices. Await resolution, then explicit approval.

## Rules

- Unresolved conflicts/uncertainty prevent proceeding.
