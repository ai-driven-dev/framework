# 01 - Capture rule

Frame the request, compare it with existing policies, plan the publication and decide with the user.

## Input

**Request.** A topic, `auto`, or a publish/delete; default manual.

## Output

Approved candidates with their planned publication paths, or confirmed sources, operation and destinations.

## Process

1. **Confirm.** Confirm the operation and [destination](../references/rule-publication.md).
   - **Missing hosts.** Detect them, propose installations and await selection before drafting.
2. **Frame.** Settle the topic.
   - **Manual.** Ask for the missing topic.
   - **Auto.** Scan, propose topics and await selection.
   - **Publish/delete.** Confirm sources and whole publications, then plan.
3. **Draft.** Fill the [template](../assets/rule-template.md) per [authoring](../references/rule-authoring.md), once the topic and [fields](../references/rule-publication.md#operations) are confirmed.
4. **Compare.** [Discover policies](../references/rule-discovery.md) read-only in the project and loaded ancestors, skip home and account scans, then [assess](../references/rule-assessment.md) each candidate.
5. **Plan.** For a host, serialize the request outside the destinations and run the writer with `--plan` per [publication](../references/rule-publication.md); a refusal returns to Draft.
6. **Present.** Show full candidates, the planned paths and every finding, new rules included.
   - **Needs review.** Ask for evidence and reassess before offering source changes.
   - **Resolved.** Await the resolution, then the explicit approval.
