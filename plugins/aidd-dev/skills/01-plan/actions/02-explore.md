# 02 - Explore

Read the codebase to ground the plan: what it touches, which rules apply, what is feasible. Read only.

## Input

The gathered source from `01-gather`.

## Output

The architecture projection (files to modify, create, delete, each with a one-line reason), the project rules that apply (each justified in one line, or none), the feasibility checks (each source consulted, a doc URL or an in-repo file, and what it settled), and the risks.

## Process

1. **Read.** Explore the code the source touches and build the projection with its infrastructure assumptions.
   - The primary caller may delegate independent, bounded read-only questions to available explorers when useful. Each returns references and unresolved questions.
   - Reconcile their findings against the source before planning. Resolve conflicting claims or retain the uncertainty. An isolated agent never delegates again.
2. **Check.** Verify against the official docs or the in-repo code. Keep each source and what it settled. Flag blockers and risks.
3. **Select.** Keep the project rules that apply to the projection.

## Test

| Case | Pass |
| --- | --- |
| The exploration completes | The projection names files to modify, create, and delete with reasons; applicable rules are justified or none apply. |
| A feasibility claim is made | Its source and what it settled are recorded. |
| Exploration is delegated | Returned references and unresolved questions are reconciled into the projection and risks. |
| Sources disagree | The conflict is resolved with evidence or remains explicit as uncertainty. |
