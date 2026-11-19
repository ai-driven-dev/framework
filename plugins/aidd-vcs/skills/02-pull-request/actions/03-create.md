# 03 - Create

Open the approved request, link it to the session, and label it.

## Input

The approved title, body, and base from `02-draft`.

## Output

The request's URL and number, with its head SHA, base, and creation status. This is input to `04-follow-up`, not proof that delivery is complete.

## Process

1. **Open.** Reuse an existing request for this branch or create it via the configured tool, passing the approved base, title, body, and draft/Ready state required by the repository contract.
2. **Link.** On T3, the next tool call after creation is `link_pull_request` with the full URL (all layers for a stack). Report a failed link; linking does not subscribe to events.
3. **Label.** When the head prefix maps to a triage label that exists, apply it; skip silently otherwise.
4. **Continue.** Read and run [04-follow-up](04-follow-up.md), including when a local creation skill opened the request. Reconcile an already performed local follow-up rather than starting a second owner.

## Test

- The request exists in the required draft/Ready state with its base equal to the resolved base.
- A mapped, existing triage label is applied; an absent one is skipped without error.
- The request is reachable at its URL with the head branch as its source.
- Creation continues to follow-up; a URL or link alone is never reported as monitored.
