# 01 - Build

Draft a fresh spec from a free-form request, or by lifting fields from an existing PRD.

## Input

A free-form request, or a path to a PRD.

## Output

The path to `spec.md`, or no write.

## Process

1. **Qualify.** Stop and ask for a clearer request when this one is too vague to draft.
2. **Source.** Map the input onto [spec-template.md](../assets/spec-template.md). From a PRD, lift its target, hard constraints, non-goals and done-when.
3. **Gaps.** List every gap per [tbd-marker.md](../references/tbd-marker.md).
4. **Check.** No required section missing. Omit an optional one with nothing to say, never a placeholder.
5. **Write.** Save it in `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`, reusing this feature's folder when one exists.
6. **Return.** Its path and its gaps.

## Test

| Case | Pass |
| --- | --- |
| The action completes | `spec.md` exists, with every section [spec-template.md](../assets/spec-template.md) requires |
| The spec is read back | it carries no library name, framework pattern, or source-file layout |
| A gap exists | it is listed once, in the open questions section only |
| Too vague | no write; one clarifying question returned |
