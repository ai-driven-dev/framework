# 03 - Prepare Run

Make every scenario executable before running.

## Input

Verified prerequisites and the locked scope.

## Output

Per scenario: fixture, initial URL, minimal steps, expected outcome, proven teardown, and isolated session id, viewport, and permissions. Plus every scenario rejected here, with its reason.

## Process

1. **Reuse.** Read [the runner reference](../references/interface-browser-playwright-cli.md), then resolve entry, auth, fixtures, and reset from the `Browser QA` section of `aidd_docs/memory/testing.md` when it exists, then a related browser test.
2. **Prove.** A documented reset that deletes data: start nothing until its storage is proven test-only by `Browser QA` memory, an isolated fixture or config, or the user; never by an environment name or your own inference, whether this run resets or not.
3. **Preflight.** Start the entry in the background for the whole run and check it; resolve what is still missing with one targeted snapshot. An entry that crashes or serves no browser UI gets one fallback entry the same memory or browser test names (a file found in the tree is not one), else `blocked` with the shortest decisive error; never invent a start command. Take viewport and permissions from the criterion, then `Browser QA` memory, then `1280×720` and browser defaults, and record them in the prepared run; a mobile criterion without dimensions asks.
4. **Authenticate.** Establish the role before running; never put login discovery or secrets in the report.
5. **Fixture.** Use deterministic data per setup; never pick a live record by guesswork.
6. **Rehearse.** Only non-mutating steps and selectors; never the final state-changing action.
7. **Reset.** Resolve a verified, executable teardown per state-changing scenario; without one, reject the scenario and carry it forward with its reason. If preparation changed state, run the teardown and verify the baseline now, not at a restart.

## Test

- Storage not proven test-only: no entry starts and no snapshot is taken.
- A state-changing scenario without a verified teardown is rejected with its reason.
- No login discovery, secret, or guessed live record appears in the report.
- Preparation that changed state is torn down and verified before the run is ready.
