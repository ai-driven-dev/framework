# Rating and readiness

The definitions every action in this skill relies on. Read this before drafting, estimating, prioritizing, or saving.

## INVEST

Each story must satisfy all six:

- **Independent**: it can ship without waiting on another story in the batch.
- **Negotiable**: it states the need, not a frozen solution.
- **Valuable**: it delivers an outcome a user or stakeholder can perceive.
- **Estimable**: the team can size it without unresolved unknowns.
- **Small**: it fits inside one iteration.
- **Testable**: its acceptance criteria can be checked objectively.

## Definition of Ready

A story is ready to save when all hold:

- Acceptance criteria are written and testable.
- Dependencies are named or confirmed absent.
- Story points are set.
- An impact rating is assigned.
- No blocking question remains open.

## Functional Definition of Done

Each story carries a pragmatic, functional DoD.

- It lists observable, user-facing conditions that mean the goal is achieved.
- It is phrased from the user's side: what the user can now do, see, or avoid.
- It stays functional. It never lists technical delivery steps such as code review, test coverage, or deployment.
- Keep it short: two to four bullets that a non-technical stakeholder can confirm.

Example for a password-reset story:

- The user requests a reset and receives the link within one minute.
- Following the link lets the user set a new password and sign in with it.
- An expired or reused link shows a clear message and offers a fresh request.

## Impact scale

Rate each story by its impact on the existing system. This is a risk signal, not the effort estimate.

- **minor**: additive or isolated. It touches no existing behavior users already rely on.
- **major**: it changes existing behavior, a shared component, or a public contract. Existing flows need re-checking.
- **critic**: it touches a critical path (auth, payments, data integrity) or risks data loss or downtime. It needs explicit review before build.

State a one-line rationale with every rating.

## Prioritization

Rank the backlog by value against effort, then break ties with impact.

- Order by descending value-to-effort ratio.
- On a tie, the lower-impact story ranks first, since it ships with less risk.
- A `critic` story may be pulled earlier only when later stories depend on it; state that reason when it happens.
