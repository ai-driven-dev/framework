# 01 - Build

Create a new spec from a free-form request, or by lifting fields from an existing PRD.

## Input

A free-form request, or a path to a PRD.

## Process

1. Read the request or the PRD.
   - Too vague to draft: ask one clarifying question and stop.
2. Fill [spec-template.md](../assets/spec-template.md) per [spec-content.md](../references/spec-content.md).
   - From a PRD: map Goals to Target, Acceptance Criteria to Done-when, Non-Goals and Open Questions as they are, and take hard constraints only from its Dependencies.
3. Write it to `spec.md` in this feature's task folder, else in a new `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`.
4. Run [validate-spec.cjs](../scripts/validate-spec.cjs) on `spec.md`, fix, repeat until it passes.
5. Answer with its path.

## Output

`spec.md`, or one clarifying question and no write.
