# 01 - Capture rule

## Input

Topic, `auto`, or publish/delete; default manual.

## Output

Approved candidates or confirmed sources, operation and destinations.

## Process

1. Confirm operation and [destination](../references/rule-publication.md). Missing hosts: detect and propose installations; await selection before drafting/assessment.
2. Manual: request missing topic. Auto: scan/propose topics; await selection. Publish/delete: confirm sources and whole publications; skip drafting/assessment to Write.
3. Create/update: confirm topic and [fields](../references/rule-publication.md#operations); draft full [candidates](../assets/rule-template.md) per [authoring](../references/rule-authoring.md).
4. [Discover policies](../references/rule-discovery.md) read-only; [compare](../references/rule-assessment.md).
5. Show full candidates and all findings. Needs review: request evidence; reassess before proposing source changes. Otherwise offer relevant choices; await resolution, then explicit subsequent approval.

## Rules

- Unresolved conflicts/uncertainty prevent proceeding.
