# 03 - Create

Open the draft request and label it.

## Input

The title, body, and base from `02-draft`.

## Output

The draft request, its title, link, and main changes.

## Process

1. **Open.** Create the request as a draft via the configured tool, passing the base, title, and body.
2. **Label.** When the head prefix maps to a triage label that exists, apply it; skip silently otherwise.
3. **Return.** Verify the draft, base, title, and body.
   Return a table with its title, link, and main-change bullets from the body.
   Include the head and base when useful.

## Test

- The request exists as a draft with its base equal to the resolved base.
- A mapped, existing triage label is applied; an absent one is skipped without error.
- The request is reachable at its URL with the head branch as its source.
- The response table contains the title, request link, and the same main-change bullets as the body.
