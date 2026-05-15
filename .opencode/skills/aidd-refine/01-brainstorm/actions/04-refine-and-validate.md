# 04 - Refine and Validate

Finalize the request and validate for remaining ambiguity.

## Inputs

- `updated_request` : user request with clarification answers

## Outputs

Refined request and validation result.

```json
{
  "refined_request": "Consolidated description",
  "is_clear": true,
  "issues": []
}
```

## Depends on

- `03-integrate-answers`

## Process

1. Consolidate `updated_request` into coherent description.
2. Check for ambiguity using `references/ambiguity-detection.md`.
3. Output refined request, clarity flag, and any issues.

## Test

- Refined request is clear and consolidated; `is_clear` is accurate.
