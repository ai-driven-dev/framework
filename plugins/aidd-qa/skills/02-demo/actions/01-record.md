# 01 - Record

## Input

Journey steps and expected outcome (e.g. `qa.md` scenario), candidate (branch, commit, URL), optional destination.

## Output

One artifact named after its `journey slug`, never `happy-path` for a bug: browser journey => WebM; CLI journey => `.txt` transcript of commands, outputs and exit status. Label `pass`, `fail` (as observed, not expected), or `blocked`; never stage or fake.

Caller's folder, else beside the journey's source (`qa/` beside `qa.md`), never a temporary directory.

## Process

1. Check browser dependencies: `npx`, pinned `@playwright/cli`, plus `ffmpeg` and `ffprobe` only for a browser video.
2. Missing dependency: ask once to install outside the application manifest; declined or recheck fails => stop with shortest decisive error.
3. Reach initial state with deterministic data; authenticate off-camera. Require verified teardown for state changes.
4. Browser: [recorder](../references/interface-browser-playwright-cli.md). CLI: capture commands, outputs and exit status verbatim. Failed step => `fail`, otherwise `pass`.
5. Setup/tooling failure: discard, reset, retry once; second failure => `blocked`.
6. After state changes, teardown and verify baseline before closing.
7. Return paths and labels. Only when the user invoked it directly, ask `Open <video> in the browser for review?`; open on confirmation.

## Test

- Mismatch: keep observed take, labelled `fail`.
- Second operational failure: `blocked`.
- Artifact: no secret or guessed live record.
