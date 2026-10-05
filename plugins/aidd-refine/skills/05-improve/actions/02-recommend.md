# 02 - Recommend

Reduce avoidable work without reducing reliability.

## Input

The evidence boundary, timing and usage tables, complete conversation, and scope index.

## Output

A `## Recommendations` table with `ID | Focus | Type | Diagnostic | Evidence | Smallest change | Source | Saving`, plus non-actionable limitations.

## Process

1. **Scope.** Always assess `behavior`; add `skill` or `knowledge` for indexed skill resources, instructions, or memory.
2. **Dispatch.** With multiple scopes and isolated or minimal context, run one read-only analyst per scope in parallel. Otherwise analyze locally.
   - Prefer a cheap model and low reasoning effort when per-agent overrides are supported; otherwise inherit host defaults.
   - Give the behavior analyst the frozen transcript; give each artifact analyst the boundary, indexed turns, and paths.
   - Give every analyst steps 3–7; require table rows and no writes.
3. **Reflect.** Ask yourself, for each scope; keep this assessment internal:
   - How could the next run be faster or better?
   - What should be removed or clarified? What was counterproductive?
   - Where should change live? How could it save time or tokens?
   - Which back-and-forth, bottlenecks, or tool calls could be removed, batched, parallelized, or replaced?
4. **Verify.** Resolve and read each maintained source before judging it; never target caches or installs. Account for intentional host transforms. Judge only `checked` sources; an installed artifact never makes its source `checked`.
5. **Assess.** Use `obsolete`, `over-specific-or-time-bound`, `duplicate`, `inconsistent`, `counterproductive`, or `correct`.
   - Compare observed work with the shortest reliable path to the requested result. Keep checks for mutable state or unresolved uncertainty; reuse still-valid results instead of repeating research.
   - Raw call count never proves waste. Ground the smallest general correction in evidence.
   - Recommend memory only for concise, durable knowledge that prevents recurring rediscovery, never transient state or one-off implementation details.
   - For skills, especially knowledge: delete evidence-backed waste or inconsistency first, without quota; then consolidate or clarify.
   - Reuse or strengthen existing content; add only for a demonstrated gap it cannot cover. Preserve useful context and requirements; use `correct` when it already suffices.
   - Claim time savings from blocking-time or resource-impact evidence, never background-process uptime alone.
   - `correct` means `no change`, never a recommendation.
6. **Merge.** Deduplicate, then verify cited evidence against the frozen source.
7. **Render.** Order by focus, then `behavior`, `skill`, `knowledge`. Report findings, not the questionnaire. Use the fewest actionable words.
   - Every recommendation, including behavior or tooling, needs an exact maintained source path, exact current excerpt, minimal replacement or explicit `+`/`−` edit, and a short target/action prompt.
   - If no source resolves or no useful persistent edit exists, render a collapsed limitation, not an accept-toggle recommendation.
   - Type: `skill`, `behavior`, `knowledge`, or `tooling`.
   - Saving: `time`, `tokens`, `both`, or `unknown`.
   - Use `no change` when evidence supports none.

## Test

| Case | Pass |
| --- | --- |
| Dispatch | parallel only for multiple isolated scopes; otherwise local |
| Analysis | internal assessment answers every question with exact evidence or `no change` |
| Efficiency | shortest reliable path; necessary checks retained; repeated work evidenced |
| Finding | exact evidence, maintained source path, minimal edit, and target/action prompt |
| No finding | `no change`; no false recommendation |
| Coverage | verdicts only for `checked` files; other scopes stay explicit |
| Limitation | unresolved or non-persistent work is not actionable |
| Output | allowed labels, types, savings, and stable order; no `improve` evidence |
