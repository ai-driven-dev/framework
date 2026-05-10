# 01 - Build

Create a fresh spec from a free-form request or by extracting fields from an existing PRD.

## Inputs

```yaml
request: <free-form human description>   # required when prd_path is absent
prd_path: <path to an existing PRD file> # required when request is absent
working_dir: <directory>                  # required; where spec.md is written
```

## Outputs

```yaml
spec_path: <path to the generated spec.md>
status: draft
notes: <ambiguities, assumptions made, questions for the human>
```

## Process

1. **Source resolution**. Pick first match:
   - `prd_path` provided -> parse the PRD, lift target, hard constraints, non-goals, and done-when into the matching template sections; drop libraries, patterns, and file-layout content
   - `request` provided -> use `assets/spec-template.md` directly and map the request onto its sections
2. **Mark gaps**. Replace any missing required field with `TBD: <precise question>`. Never guess.
3. **Section check**. Confirm every section listed in `assets/spec-validator.yml` is present.
4. **Write**. Save the spec to `working_dir/spec.md`.
5. **Return** the structured Outputs block with `status: draft`.

## Test

- **File saved**: `spec_path` exists on disk after the action completes.
- **All sections**: the file contains every section listed in `assets/spec-validator.yml`.
- **No implementation**: the file has no library names, framework patterns, or source-file layout.
