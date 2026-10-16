# 01 - Capture rule

Frame the request, compare it with existing policies, plan the publication, decide with the user.

## Input

Request: a topic, `auto`, or a publish/delete. Default manual.

## Output

Approved candidates with planned paths, or confirmed sources, operation and destinations.

## Process

1. Confirm the operation and [destination](../references/rule-publication.md).
   - Hosts: reuse the existing rule's hosts, else ask. Missing hosts: detect, propose installation, await selection before drafting.
2. Frame the topic.
   - Manual: ask for it.
   - Auto: scan, propose topics, await selection.
   - Publish/delete: confirm sources and whole publications, then plan.
3. Draft with the [template](../assets/rule-template.md) and [authoring](../references/rule-authoring.md), once topic and [fields](../references/rule-publication.md#operations) are confirmed.
4. Compare: [discover policies](../references/rule-discovery.md) read-only in the project and loaded ancestors, never home or account scans, then [assess](../references/rule-assessment.md) each candidate.
5. Plan: for a host, resolve the installed writer to an absolute path, write the request outside the destinations, run it with `--plan` per [publication](../references/rule-publication.md). A refusal returns to step 3.
6. Present each candidate in full (body, description, scope, hosts), the planned paths and every finding (new rules too), then end the turn.
   - Needs review: ask for evidence, reassess before offering source changes.
   - Resolved: replan, present the revised candidate, end the turn again.
