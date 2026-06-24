# 02 - Explore

Read the codebase to ground the plan: what it touches, which rules apply, what is feasible. Read only.

## Input

The gathered source from `01-gather`.

## Output

The architecture projection (files to modify, create, delete, each with a one-line reason), the project rules that apply (each justified in one line, or none), the feasibility checks (each source consulted, a doc URL or an in-repo file, and what it settled), and the risks.

## Process

1. **Read.** Explore the code the source touches. Build the projection and list the infrastructure assumptions.
2. **Check.** Verify against the official docs or the in-repo code. Keep each source and what it settled. Flag blockers and risks.
3. **Select.** Keep the project rules that apply to the projection.

## Test

- The projection lists files to modify, create, and delete, each with a one-line reason.
- Every feasibility check records its source and what it settled.
- The applicable rules are identified and justified, or none apply.
