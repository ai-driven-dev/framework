# 01 - Build

Draft a fresh spec from a free-form request, or by lifting fields from an existing PRD.

## Input

A free-form request, or a path to an existing PRD. A feature name for the folder, derived from the request when absent.

## Output

The path to `spec.md` in the feature folder, drafted from the template, with its gaps listed. No write when the request is too vague.

## Process

1. **Qualify.** Stop and ask for a clearer request when this one is too vague to draft.
2. **Source.** Map the input onto [spec-template.md](../assets/spec-template.md), dropping any implementation detail. From a PRD, lift its target, hard constraints, non-goals and done-when.
3. **Gaps.** List every gap per [tbd-marker.md](../references/tbd-marker.md).
4. **Check.** Every required section present. Omit an optional one with nothing to say, never a placeholder.
5. **Write.** Save it in `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`, reusing this feature's folder when one exists.
6. **Declare.** When the request names a backlog item and the folder carries no `backlog-link.json`, write one there:

   ```json
   {
     "backlog": "owner/repo#123",
     "written_at": "2026-08-21T09:00:00Z",
     "written_by": "aidd-pm:04-spec"
   }
   ```

   `backlog` is one field, a forge reference or a project-relative Markdown path, never both. `written_at` is now, ISO 8601 UTC.

   Write nothing when the request names none: an undeclared folder is normal. Never overwrite the file, so a correction by hand survives.
7. **Return.** Its path and its gaps.

## Test

| Case | Pass |
| --- | --- |
| The action completes | `spec.md` exists in the feature folder |
| The file is validated | every section required by [spec-validator.yml](../assets/spec-validator.yml) is present |
| The spec is read back | it carries no library name, framework pattern, or source-file layout |
| A gap exists | it is listed once, in the open questions section only |
| Too vague | no write; one clarifying question returned |
| The request names a backlog item | `backlog-link.json` names it, with `written_at` and `written_by` |
| It names none | no file is written, and nothing errors |
| The file exists | it is left unchanged, even for a different item |
