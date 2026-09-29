---
type: defect
status: reported
---

# Defect: commit-session-trailer dedup fails on git 2.39 when the fixture message has no trailing newline

## Context

`cli/tests/contexts/telemetry/domain/formats/commit-session-trailer.integration.test.ts:72` ("never doubles a trailer a prior run already wrote") runs the trailer-writing delegate twice against a source git and asserts the trailer token appears once. The test, its source, and the delegate are byte-identical on `main`, `upstream/next`, and the mistral-support branch (all from the same commit); the failure predates that branch.

## Expected

The trailer is not doubled by a second run, on any supported git version.

## Actual

On git 2.39.2 the test fails with `AssertionError: expected 2 to be 1`: the fixture message has no trailing newline, so git appends the trailer without a blank-line separator; the second pass then sees no trailer block and `--if-exists doNothing` appends again. With a message ending in a newline the same delegate dedupes correctly (verified in a standalone repro).

## Reproduction

1. `git --version` -> 2.39.2.
2. `cd cli && npx vitest run tests/contexts/telemetry/domain/formats/commit-session-trailer.integration.test.ts` -> fails alone, fails under `env -i`, deterministic.
3. Same command on a machine with a newer git passes (CI's git presumably newer).

## Impact

The cli suite reports one failure per run on git 2.39 machines, masking real regressions in the file and eroding trust in the suite's signal.

## Evidence

- Phase 2 record: `aidd_docs/tasks/2026_09/2026_09_29_mistral-support/phase-2.md`, failure section with the repro sketch.
- Standalone 10-line repro of the delegate: message without trailing newline doubles the trailer; message with one dedupes.

## Verification

The test passes on git 2.39.2 and newer (fixture message ends with a newline, or the delegate normalizes before appending).

## Cancellation

—
