# 01 - Capture rule

## Input

Topic, `auto`, or publish/delete selection. Empty means manual.

## Process

1. **Prepare.** Confirm intent and targets through [tool-paths.md](../references/tool-paths.md).
   - Publish/delete: confirm sources and hosts, then action 02.
   - Auto: scan and propose rules first.
   - Create/update: draft complete bodies, metadata and scope in context using [rule-template.md](../assets/rule-template.md) and [rule-authoring.md](../references/rule-authoring.md).
2. **Compare.** Read sources from `tool-paths.md`; compare obligations, prohibitions, scope, conditions, exceptions and priority, including prior sources for updates.
3. **Resolve.** Classify new, covered, overlap, conflict or needs review; show full candidates with paths, decisive text and scope reasoning, then request a decision.

## Rules

- Report unsupported hosts and alternatives.
- Exclude only proven disjoint scopes, independently of current files.
- Never proceed with unresolved conflicts/uncertainty.
