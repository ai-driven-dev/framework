# 01 - Spec

Consolidate every available source into the normalized contract consumed downstream.

**Skip condition:** if the source ticket already carries an explicit objective + at least one acceptance criterion, set `spec_status = skipped`, surface them verbatim, jump to action 02.

## Inputs

- `request` - raw `$ARGUMENTS` (free-form text or ticket URL)
- `sources` - one or more of: ticket body, existing PRD, in-session conversation, prior reviewer findings
- `working_dir` - repo root

## Outputs

```yaml
spec_path: <path | null when skipped>
spec_status: drafted | refined | skipped
objective: <one-sentence intent>
acceptance_criteria: [<line>]
```

## Process

1. **Collect.** Resolve every non-empty source: fetch ticket bodies, read PRD files, snapshot reviewer findings, capture conversation turns. Concatenate into a single brief.
2. **Skip check.** Apply the skip condition above. If skipped, return.
3. **Delegate.** Hand the consolidated brief and `working_dir` to `spec`; let it own contract generation and refinement.
4. **Return** `spec_path`, `spec_status`, `objective`, `acceptance_criteria` to the SDLC orchestrator.

## Test

When `spec_status` is `drafted` or `refined`, `spec_path` exists on disk and the file's frontmatter carries the same `objective` and non-empty `acceptance_criteria` returned by this action; when `skipped`, `spec_path` is null and both fields are extracted verbatim from the source ticket.
