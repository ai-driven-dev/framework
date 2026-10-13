# 01 - Capture rule

## Input

A free-form rule request.

## Process

1. **Prepare.** Read [tool-paths.md](../references/tool-paths.md) and [rule-authoring.md](../references/rule-authoring.md).
   - Publish/delete: confirm sources and hosts, then action 02.
   - Manual (default): ask for a missing topic before drafting.
   - `auto`: scan/propose, then await user selection before drafting.
   - Create/update: confirm topic, category/slug, description, scope and mode/hosts; draft complete bodies and metadata in context using [rule-template.md](../assets/rule-template.md).
2. **Compare.** Read sources from `tool-paths.md`; verify host/interface applicability, then compare obligations, prohibitions, scope, conditions, exceptions and priority, including prior sources for updates.
3. **Resolve.** Classify through `rule-authoring.md`; show all findings and full candidates with paths, decisive text and scope reasoning; propose relevant create/keep/update/merge/scope/priority/cancel resolutions, then request a decision.

## Rules

- Report unsupported hosts and alternatives.
- Exclude only proven disjoint scopes, independently of current files.
- Never proceed with unresolved conflicts/uncertainty.
