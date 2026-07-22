# 05 - Confirm Approval

Present the final refined request and wait for user approval.

## Inputs

- `refined_request` from previous action.

## Outputs

Approval prompt displayed.

```text
Does this refined request look correct? (Yes/No)
```

## Depends on

- `04-refine-and-validate`

## Process

1. Display `refined_request` clearly.
2. Output approval prompt and wait for response.

## Test

- Prompt is displayed with the refined request.
