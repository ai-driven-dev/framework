# Explore

## Input

The gathered source.

## Output

- **Projection.** Files to modify, create, or delete, each with a reason.
- **Rules.** Applicable project rules and why, or none.
- **Evidence.** Sources consulted and what each settled.
- **Risks.** Blockers, conflicts, and unresolved questions.

## Process

1. **Scope.** Identify the code and contracts the request touches.
   - **Delegate.** The primary caller may assign independent questions by relevant codebase domain, such as frontend, backend, or a bounded context, to available explorers; give each a scope and requested evidence.
2. **Verify.** Check feasibility against in-repo code or official documentation.
3. **Reconcile.** Combine findings into the projection and applicable rules; resolve conflicting claims with evidence or retain the uncertainty.

## Rules

- **Boundaries.** Explore only relevant domains; delegation is optional and isolated agents never delegate again.
