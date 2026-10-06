# 02 - Recommend

Analyze each relevant scope with the smallest grounded change.

## Input

The evidence boundary, timing and usage tables, complete conversation, and scope index.

## Output

A `## Recommendations` table with `ID | Question | Type | Diagnostic | Evidence | Smallest change | Target | Saving`.

## Process

1. **Scope.** Select `behavior`, plus `skill` and `knowledge` only when the scope index names relevant artifacts.
2. **Dispatch.** Analyze locally when one scope exists; otherwise dispatch one read-only analyst per scope in parallel.
   - Prefer a lightweight available model and low reasoning effort when the host supports per-agent overrides; otherwise inherit the run defaults.
   - Give the behavior analyst the complete frozen transcript; give artifact analysts the same boundary, indexed turns, and exact artifact paths.
   - Request isolated or minimal context for artifact analysts when supported; otherwise analyze every scope locally instead of duplicating the transcript.
   - Do not dispatch an analyst with no relevant evidence.
   - Require table rows only and forbid file writes.
3. **Question.** Make each analyst answer every prompt for its scope.
   - How could the next run be faster or better?
   - What information should be removed or clarified?
   - Where should the change live?
   - How could it save time or tokens?
   - What work was counterproductive?
4. **Verify.** Read a named skill or knowledge file before assessing its information.
5. **Assess.** Label relevant information `obsolete`, `over-specific-or-time-bound`, `duplicate`, `inconsistent`, `counterproductive`, or `correct`.
   - Use `correct` when no evidence supports another label, and never render it as a recommendation.
6. **Merge.** Deduplicate findings across scopes and verify only their cited evidence against the frozen source.
7. **Render.** Order by question then `behavior`, `skill`, `knowledge`, and describe each change with the fewest unambiguous words.
   - Use `skill`, `behavior`, `knowledge`, or `tooling` as the target type.
   - State `time`, `tokens`, `both`, or `unknown` as its saving.
   - Render `no change` when a scope has no evidence-backed recommendation.

## Test

| Case | Pass |
| --- | --- |
| A question is shown | it is answered from conversation evidence |
| One relevant scope exists | no parallel analyst is dispatched |
| Several relevant scopes exist | their analysts run in parallel and return the same columns |
| An artifact analyst cannot receive isolated context | every scope is analyzed locally instead of duplicating the transcript |
| A type is shown | it is `skill`, `behavior`, `knowledge`, or `tooling` |
| Information is assessed | it has one allowed label backed by evidence |
| Information is correct | its scope says `no change` and no recommendation is rendered |
| A named target is assessed | the target file was read before the verdict |
| A saving is shown | it is categorical and never an invented amount |
| The same evidence is analyzed again | recommendations keep the same order and do not cite an earlier `improve` report |
