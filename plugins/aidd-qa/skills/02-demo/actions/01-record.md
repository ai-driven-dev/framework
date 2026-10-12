# 01 - Record

Record one clean, short, validated take per journey.

## Input

A journey (steps and expected outcome, such as a `qa.md` scenario) and a candidate (branch, commit, or running URL).

## Output

One final WebM per journey, named `happy-path.webm` or `edge-case-<scenario-slug>.webm`, labelled with the observed outcome (`pass`, `fail`, or `blocked`).

## Process

1. **Check.** In one pass, resolve `npx`, run `npx --yes @playwright/cli@0.1.17 --version`, and resolve `ffmpeg` and `ffprobe`. Continue silently when all pass.
2. **Resolve.** A dependency is missing: ask once whether the user installs it or authorizes you to. If authorized, install only the missing ones and recheck. If declined or a recheck fails, stop with the shortest decisive error. Never add them to the application manifest.
3. **Prepare.** Reach the journey's initial state with deterministic data and the role authenticated off-camera. A state-changing journey without a verified teardown is not recorded.
4. **Record.** Follow [interface-browser-playwright-cli.md](../references/interface-browser-playwright-cli.md). Keep the take of a mismatch.
5. **Label.** From the returned step results: any `ok: false` => `fail`, else `pass`.
6. **Recover.** A setup failure, throw, or non-zero exit discards the take; reset and retry once. A second one => `blocked`.
7. **Reset.** After each state-changing take, run its teardown, verify the baseline, then close the session.
8. **Normalize.** At most two independent raw files concurrently. Keep only a file whose `ffprobe` and frame inspection pass.
9. **Clean.** Delete raw takes and validation frames only after every final file passes codec, dimension, duration, path, cut-point, and frame checks. Never retain screenshots or alternate media.
10. **Return.** Output each video path, its label and duration. When `happy-path.webm` exists, ask `Open happy-path.webm in the browser for review?` and open it when confirmed.

## Test

- Passing checks produce no message; a missing dependency produces one choice and no unapproved installation.
- A product mismatch yields a `fail` label from the returned results, never a thrown take; a second operational failure yields `blocked`.
- Raw takes and frames survive until every final file passes; then only the final WebM files remain.
- A take over 12 seconds is re-recorded without non-journey actions, never accelerated.
- No login discovery, secret, or guessed live record appears in a video.
