# 01 - Record

## Input

Journey steps and expected outcome, candidate, optional destination.

## Output

One artifact named for each journey: browser WebM or CLI `.txt` transcript (commands, outputs, exit status). Label observed `pass`/`fail` or `blocked`; never stage or invent outcomes.

Use the caller's folder, else `qa/` beside the journey source; never a temporary destination.

## Process

1. Missing dependency: ask once to install outside the application manifest; refusal/recheck failure => `blocked` with the error.
2. Use documented deterministic test data and verified teardown; authenticate off-camera, exclude secrets.
3. Browser: [recorder](../references/interface-browser-playwright-cli.md). CLI: capture verbatim, including failures.
4. Tool failure: reset and retry once, then `blocked`.
5. Restore and verify baseline before closing.
6. Direct browser calls: offer to open the video; open on agreement.

## Test

Artifact readable/playable; evidence matches the observed journey.
