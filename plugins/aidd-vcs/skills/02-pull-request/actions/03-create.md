# 03 - Create

Open the approved draft request and label it.

## Input

The approved title, body, and base from `02-draft`.

## Output

The draft request's URL and number, with its head and base.

## Process

1. **Open.** Create the request as a draft via the configured tool, passing the base, title, and body.
2. **Label.** When the head prefix maps to a triage label that exists, apply it; skip silently otherwise.
3. **Return.** Surface the URL, number, head, and base.

## Test

- The request exists as a draft with its base equal to the resolved base.
- A mapped, existing triage label is applied; an absent one is skipped without error.
- The request is reachable at its URL with the head branch as its source.
