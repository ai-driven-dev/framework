# 03 - Prepare Run

Make every scenario executable before recording.

## Input

Verified prerequisites and the locked scope.

## Output

Per scenario: fixture, initial URL, minimal steps, expected outcome, proven teardown, and isolated session id. Plus every scenario rejected here, with its reason.

## Process

1. **Reuse.** Resolve entry, auth, fixtures, and reset from the `Browser QA` section of `aidd_docs/memory/testing.md` when it exists, then a related browser test, then one targeted snapshot. Stop once executable.
   - Before starting the entry, prove the storage it mounts is test-only when its reset deletes data. Unproven: ask once, never guess.
2. **Preflight.** Check the application and fixed `1280×720` viewport.
3. **Authenticate.** Establish the role before recording; never show login discovery or secrets in evidence.
4. **Fixture.** Use deterministic data per setup; never pick a live record by guesswork.
5. **Rehearse.** Only non-mutating steps and selectors; never the final state-changing action.
6. **Reset.** Resolve a verified, executable teardown per state-changing scenario; without one, reject the scenario and carry it forward with its reason. If preparation changed state, run the teardown and verify the baseline now, not at a restart.

## Test

- An entry on storage not proven test-only is never started when its reset deletes data; it produces one question.
- A state-changing scenario without a verified teardown is rejected with its reason.
- No login discovery, secret, or guessed live record appears in evidence.
- Preparation that changed state is torn down and verified before the run is ready.
