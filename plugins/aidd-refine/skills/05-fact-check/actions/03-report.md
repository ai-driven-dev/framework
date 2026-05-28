# 03 - Report

Rewrite the original text grounded in the verdicts: cite verified claims, hedge unverified ones, surface conflicts. The output is reader-facing prose only.

## Output discipline (hard constraint - read first)

The delivered output contains EXACTLY these blocks, in this order, and nothing else:

1. The rewritten text, with a `[n]` marker on each verified claim and a `(unverified - no source found)` marker on each unverified claim.
2. A `## Sources` block.
3. A `## Unverified claims` block - only when at least one claim is unverified.

The following are internal to actions 01 and 02. They are FORBIDDEN in the output - never write them:

- Any cascade or tier trace. Never emit the words `Cascade`, `tier 1`, `tier 2`, `tier 3`, `miss`, `N/A`, or `resolved` in the output.
- Any category label - `hard-to-know`, `version`, `api-signature`, `date-event-person`, `project-fact`.
- Any raw verdict vocabulary - `verdict`, `claim false`, `claim true`, or the enum values `verified` / `conflict` / `unverified` used as a status word (the inline `(unverified - no source found)` marker is the one allowed exception).
- Any sentence explaining why a cache line was or was not added.
- The report is plain prose. It is NOT styled by any active session output mode (terse, caveman, condensed, etc.). Render it normally regardless of how the surrounding conversation is styled.

Before delivering, scan the draft: if any line contains a forbidden item, delete that line.

## Inputs

- `verdict_list` (required) - the verdict list from action 02.
- `target_text` (required) - the original text, reused as the rewrite base.

## Outputs

The rewritten answer following `@../../assets/report-template.md`: original content preserved, a `[n]` marker on each verified claim, a `(unverified - no source found)` marker on each unverified claim, conflicts stated with both sides, and a `## Sources` footnote block.

## Depends on

- `02-verify`

## Process

1. Copy `@../../assets/report-template.md` as the structure.
2. Rewrite `target_text`: append `[n]` to each `verified` claim, numbered in reading order.
3. For each `conflict`, state both sides in full ("Source A reports X; source B reports Y") - choose no winner.
4. Append `(unverified - no source found)` to each `unverified` claim; never delete it, never assert it.
5. Build the `## Sources` block - one numbered entry per source, with title or file path, location, and the claim it verifies. Conflicts get one entry per side.
6. Add the `## Unverified claims` section only when at least one claim is unverified; omit it otherwise.
7. If any verified fact is stable (project paths, pinned-version APIs), append a single cache-suggestion line proposing the user cache it, with a yes/no recommendation. The skill persists nothing itself: on approval, restate the fact and its source plainly so the user (or their memory tooling) can store it. When no fact qualifies, omit the line silently - never explain its absence.
8. Apply the Output discipline scan above, then deliver.

## Test

Given one `verified` claim and one `unverified` claim, the rendered output contains a `## Sources` section with a `[1]` footnote for the verified claim and an inline `(unverified - no source found)` marker on the other, and contains none of the forbidden words (`Cascade`, `tier 1/2/3`, `verdict`, category labels).
