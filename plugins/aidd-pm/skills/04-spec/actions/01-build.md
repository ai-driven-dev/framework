# 01 - Build

Draft a fresh spec from a free-form request, or by lifting fields from an existing PRD.

## Input

A free-form request, or a path to a PRD.

## Process

1. Read the request or the PRD.
   - Too vague to draft: ask one clarifying question and stop.
2. Fill [spec-template.md](../assets/spec-template.md) from it.
   - From a PRD: Goals to Target, Acceptance Criteria to Done-when, Non-Goals and Open Questions as they are, and a hard constraint only from its Dependencies, else a gap.
3. List each gap per [tbd-marker.md](../references/tbd-marker.md).
4. Write it to `spec.md` in this feature's task folder, else in a new `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`.
5. Run [validate-spec.cjs](../scripts/validate-spec.cjs) on `spec.md`, fix, repeat until it passes.
6. Answer with its path and its gaps.

## Output

`spec.md`, or one clarifying question and no write.
