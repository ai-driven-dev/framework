# 02 - Recommend

Reduce avoidable work without reducing reliability.

## Input

The evidence boundary, timing and usage tables, complete conversation, and resource index.

## Output

An updated `Scope | Status | Evidence` index, a `## Recommendations` table with `ID | Focus | Type | Diagnostic | Evidence | Smallest change | Source | Saving`, and non-actionable limitations.

## Process

1. **Verify.** Resolve and read indexed maintained skill resources, applicable `AGENTS.md`, and task-relevant memory references once; reuse a still-valid read. Add and read only relevant paths from the project memory index; never scan unrelated memory. Neither judge from nor target caches or installs. Account for host transforms. Mark only read sources `checked`; mark unresolved or skipped ones `missing` or `not reviewed`.
2. **Scope.** Always assess `behavior`; add `skill` or `knowledge` only for checked indexed sources.
3. **Dispatch.** With multiple isolated scopes, run one read-only analyst per scope in parallel. Otherwise analyze locally.
   - Prefer a cheap model and low reasoning effort when per-agent overrides are supported; otherwise inherit host defaults.
   - Give the behavior analyst the frozen transcript. Give artifact analysts the boundary, indexed turns, and verified excerpts with evidence; allow a targeted read-only refresh only when validity is uncertain.
   - Give every analyst steps 4–6 and require table rows.
4. **Reflect.** Ask yourself, for each scope; keep this assessment internal:
   - How could the next run be faster or better?
   - What should be removed or clarified? What was counterproductive?
   - Where should change live? How could it save time or tokens?
   - Which back-and-forth, bottlenecks, or tool calls could be removed, batched, parallelized, or replaced?
5. **Assess.** Use `obsolete`, `over-specific-or-time-bound`, `duplicate`, `inconsistent`, `counterproductive`, or `correct`.
   - Compare observed work with the shortest reliable path to the requested result. Keep checks for mutable state or unresolved uncertainty; reuse still-valid results instead of repeating research.
   - Raw call count never proves waste. Ground the smallest general correction in evidence.
   - Recommend memory only for concise, durable knowledge that prevents recurring rediscovery, never transient state or one-off implementation details.
   - For skills, especially knowledge: delete evidence-backed waste or inconsistency first, without quota; then consolidate or clarify.
   - Reuse or strengthen existing content; add only for a demonstrated gap it cannot cover. Preserve useful context and requirements; classify sufficient content as `correct` => `no change`.
   - Claim time savings from blocking-time or resource-impact evidence, never background-process uptime alone.
6. **Deliver.** Deduplicate, verify cited evidence, and order by focus, then `behavior`, `skill`, `knowledge`. Report findings, not the questionnaire, in the fewest actionable words.
   - Every recommendation needs an exact maintained source path, current excerpt, minimal correction or explicit `+`/`−` edit, and a short target/action prompt.
   - If no source resolves or no useful persistent edit exists, report a non-actionable limitation.
   - Type: `skill`, `behavior`, `knowledge`, or `tooling`.
   - Saving: `time`, `tokens`, `both`, or `unknown`.
