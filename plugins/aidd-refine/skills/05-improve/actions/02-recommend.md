# 02 - Recommend

Reduce avoidable work without reducing reliability.

## Input

The evidence boundary, timeline, timing and usage tables, complete conversation, and resource index.

## Output

Coverage with `Scope | Status | Evidence`, and recommendations with `ID | Focus | Type | Diagnostic | Evidence | Smallest change | Source | Saving`. Pass through the boundary, timeline, and measurements unchanged.

## Process

1. **Verify.** Resolve and read indexed maintained skill resources, applicable `AGENTS.md`, and task-relevant memory references once; reuse a still-valid read. Add and read only relevant paths from the project memory index; never scan unrelated memory. Neither judge from nor target caches or installs. Account for host transforms. Mark only read sources `checked`; mark unresolved or skipped ones `missing` or `not reviewed`.
2. **Scope.** Always assess `behavior`; add `skill` or `knowledge` only for checked indexed sources.
3. **Dispatch.** With multiple isolated scopes, run one read-only analyst per scope in parallel. Otherwise analyze locally.
   - Prefer a cheap model and low reasoning effort when per-agent overrides are supported; otherwise inherit host defaults.
   - Give the behavior analyst the frozen transcript. Give artifact analysts the boundary, indexed turns, and verified excerpts with evidence; allow a targeted read-only refresh only when validity is uncertain.
   - Give every analyst steps 4–6 and require table rows.
4. **Reflect.** Ask yourself one question per scope, internally: "Based on the conversation, what shorter, equally reliable path could have achieved the same result, and what minimal reusable change would reduce time, tokens, or cost next run?"
5. **Assess.** Use `obsolete`, `over-specific-or-time-bound`, `duplicate`, `inconsistent`, `counterproductive`, or `correct`.
   - Assess repeated reads, back-and-forth, bottlenecks, and calls to remove, batch, parallelize, or replace. Keep checks for mutable state or unresolved uncertainty; reuse valid results.
   - Raw call count never proves waste. Ground the smallest general correction in evidence.
   - Recommend memory only for concise, durable knowledge that prevents recurring rediscovery, never transient state or one-off implementation details.
   - For skills, especially knowledge: delete evidence-backed waste or inconsistency first, without quota; then consolidate or clarify.
   - Reuse or strengthen existing content; add only for a demonstrated gap it cannot cover. Preserve useful context and requirements; classify sufficient content as `correct` => `no change`.
   - Ground savings in blocking-time, resource-impact, or exposed cost evidence. State trade-offs; background-process uptime alone proves no saving.
6. **Deliver.** Deduplicate, verify cited evidence, and order by focus, then `behavior`, `skill`, `knowledge`. Report findings, not the questionnaire, in the fewest actionable words.
   - Every recommendation needs an exact maintained source path, current excerpt, explicit `−`/`+` correction, relevant event IDs, and a short target/action prompt. Leave `+` empty for deletion-only edits.
   - Disclose unresolved sources in coverage. Omit findings without a useful persistent edit; do not invent recommendations.
   - Type: `skill`, `behavior`, `knowledge`, or `tooling`.
   - Saving: `time`, `tokens`, `cost`, their combination, or `unknown`.
