# 01 - Check PRD

Verify a PRD (product brief) exists before anything else. Without it, bootstrap cannot start - stop and ask the user to create one.

## Inputs

- The project's product brief / PRD, if any.

## Process

1. Look for a PRD / product brief - the product's *what* and *why*.
2. If absent: **stop**. Tell the user to create one first (`run skill "aidd-pm:03-prd"`), then re-run bootstrap.
3. If present: read it. It is the product context for the rest of the flow.

## Test

- [ ] A PRD exists and has been read, OR the flow halted with a clear instruction to create one.
