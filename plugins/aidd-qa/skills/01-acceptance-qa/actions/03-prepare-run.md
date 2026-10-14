# 03 - Prepare Run

## Input

Verified prerequisites and the locked scope.

## Output

Executable scenarios or rejection reasons.

## Process

1. **Resolve.** Entry, auth, deterministic fixtures and teardown come from `aidd_docs/memory/testing.md`, then a related test (`Browser QA` for browser scenarios). Never invent commands or guess live data.
2. **Prove.** Any data-deleting reset, even unused: prove its storage test-only from memory, isolated fixture/config or user confirmation, never inference. Without proof => `blocked` before any start or snapshot.
3. **Browser.** Read [the runner reference](../references/interface-browser-playwright-cli.md), start the entry and inspect missing setup with one snapshot. Failed/UI-less entry: one documented fallback, else `blocked`. Viewport/permissions: criterion, memory, then `1280×720`/browser defaults; missing mobile dimensions need a decision.
4. **Reset.** Reject mutations without documented, verified teardown. Undo preparation mutations and verify baseline. Rehearse only non-mutating steps; keep auth discovery and secrets out of reports.

## Test

Each retained scenario is reproducible without risking live data.
