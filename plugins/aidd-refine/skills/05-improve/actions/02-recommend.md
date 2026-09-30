# 02 - Recommend

Find the smallest grounded improvements.

## Input

The evidence boundary, timing and usage tables, complete conversation, and scope index.

## Output

A `## Recommendations` table with `ID | Focus | Type | Diagnostic | Evidence | Smallest change | Target | Saving`.

## Process

1. **Scope.** Always assess `behavior`; add `skill` or `knowledge` only for indexed artifacts.
2. **Dispatch.** With multiple scopes and isolated or minimal context, run one read-only analyst per scope in parallel. Otherwise analyze locally.
   - Prefer a cheap model and low reasoning effort when per-agent overrides are supported; otherwise inherit host defaults.
   - Give the behavior analyst the frozen transcript; give each artifact analyst the boundary, indexed turns, and paths.
   - Give every analyst steps 3–7; require table rows and no writes.
3. **Reflect.** Ask yourself, for each scope; keep this assessment internal:
   - How could the next run be faster or better?
   - What should be removed or clarified? What was counterproductive?
   - Where should change live? How could it save time or tokens?
   - Which back-and-forth, bottlenecks, or tool calls could be removed, batched, parallelized, or replaced?
4. **Verify.** Read each named artifact before judging it.
5. **Assess.** Use `obsolete`, `over-specific-or-time-bound`, `duplicate`, `inconsistent`, `counterproductive`, or `correct`.
   - For skills, especially knowledge: delete evidence-backed waste or inconsistency first, without quota; then consolidate or clarify.
   - Add only for a demonstrated gap the existing content cannot cover. Preserve useful context and requirements.
   - `correct` means `no change`, never a recommendation.
6. **Merge.** Deduplicate, then verify cited evidence against the frozen source.
7. **Render.** Order by focus, then `behavior`, `skill`, `knowledge`. Report findings, not the questionnaire. Use the fewest actionable words.
   - Type: `skill`, `behavior`, `knowledge`, or `tooling`.
   - Saving: `time`, `tokens`, `both`, or `unknown`.
   - Use `no change` when evidence supports none.

## Test

| Case | Pass |
| --- | --- |
| Dispatch | parallel only for multiple isolated scopes; otherwise local |
| Analysis | internal assessment answers every question with exact evidence or `no change` |
| Finding | exact turn, tool-call, or read-artifact evidence |
| No finding | `no change`; no false recommendation |
| Output | allowed labels, types, savings, and stable order; no `improve` evidence |
