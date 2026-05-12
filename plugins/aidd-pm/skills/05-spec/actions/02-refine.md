# 02 - Refine

Rewrite an existing spec in place to address reviewer findings.

## Inputs

```yaml
existing_spec: <path to the current spec>   # required
findings: <reviewer findings>                # required; list or text
```

## Outputs

```yaml
spec_path: <path to the refined spec.md>     # same as existing_spec
status: refined
notes: <changes applied, residual TBD questions>
```

## Process

1. **Load**. Read `existing_spec` and `findings`.
2. **Map findings**. Pair each finding with the section of the spec it touches.
3. **Rewrite**. Apply each finding in place: clarify wording, add missing fields, remove invalid claims. Preserve sections the findings do not touch.
4. **Mark gaps**. Replace any field still unanswered with `TBD: <precise question>`. Never guess.
5. **Section check**. Confirm every section listed in `assets/spec-validator.yml` is present.
6. **Write**. Save the refined spec back to the same path as `existing_spec` (overwrite).
7. **Return** the structured Outputs block with `status: refined`.

## Test

- **File saved**: `spec_path` exists on disk after the action completes.
- **All sections**: the file contains every section listed in `assets/spec-validator.yml`.
- **Findings addressed**: every finding in `findings` is reflected by a change in the rewritten spec or by an explicit `TBD: <question>` if it cannot be resolved.
