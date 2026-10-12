# 01 - Record

Record one validated artifact per journey.

## Input

A journey (steps and expected outcome, such as a `qa.md` scenario), a candidate (branch, commit, or running URL), and optionally a destination folder.

## Output

One artifact named after its `journey slug`, never `happy-path` for a bug repro: a browser journey yields a WebM, a CLI journey a `.txt` transcript of each command, its output and its exit status. Labelled `pass`, `fail` (shown as observed, not expected) or `blocked`.

It lands in the caller's folder, else beside the journey's source (the `qa/` folder beside `qa.md`), never a temporary directory.

## Process

1. **Check.** Resolve `npx` and the pinned `@playwright/cli` for a browser journey, plus `ffmpeg` and `ffprobe` only for a browser video.
2. **Resolve.** A dependency is missing: ask once whether to install it, never in the application manifest. Declined or a recheck fails => stop with the shortest decisive error.
3. **Prepare.** Reach the journey's initial state with deterministic data, authenticated off-camera. A state-changing journey without a verified teardown is not recorded.
4. **Record.** Browser: follow [interface-browser-playwright-cli.md](../references/interface-browser-playwright-cli.md). CLI: write each command, its output and exit status verbatim. Keep a mismatch as observed; never stage or fake it.
5. **Label.** Any failed step => `fail`, else `pass`.
6. **Recover.** A setup failure or tooling error discards the take; reset and retry once. A second one => `blocked`.
7. **Reset.** After a state-changing take, run its teardown and verify the baseline.
8. **Normalize.** Browser only: keep a file only when `ffprobe` and frame inspection pass.
9. **Clean.** Delete raw takes and validation frames once every final file passes.
10. **Return.** Output each path and label. Only when the user invoked it directly, ask `Open <video> in the browser for review?` and open it when confirmed.

## Test

| Case | Pass |
| --- | --- |
| Product mismatch | `fail`, the take kept as observed |
| Second operational failure | `blocked` |
| Take over 12 seconds | re-recorded without non-journey actions, never accelerated |
| Video or transcript | no secret or guessed live record |
