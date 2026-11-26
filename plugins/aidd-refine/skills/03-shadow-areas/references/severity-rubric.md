# Severity rubric

How severe a gap is. The validator reads the same three tiers from `scripts/custom/locked-sets.json`.

## Assignment

1. Name the downstream phase the gap hurts most: design, implementation, testing or release.
2. Assign `blocker` when the gap stops that phase entirely.
3. Assign `major` when it does not, but causes a rework cycle: a code change after review or test.
4. Assign `minor` otherwise.

Assign the highest tier that matches, never one raised on a guess, and never `blocker` for a gap found and fixed within the current phase.

## Tiers

| Tier | Decision rule | Typical gaps | Example |
| --- | --- | --- | --- |
| blocker | Work cannot proceed, or a deliverable cannot be verified, until the gap is resolved. | A required actor is absent; a requirement has no acceptance criterion at all; an unnamed dependency blocks the start; a wrong assumption would void a core design decision. | A spec defines an authorization model but never names which role grants elevated access, so the access check cannot be built. |
| major | Work can start but will be redone: an incomplete build, a failed review, or a missed requirement found in testing. | An undescribed failure mode; a missing edge case; an ambiguous term on a critical path where two readings build different things. | A payment spec omits the declined-card case; QA finds it after the happy path ships, and a fix and re-test follow. |
| minor | Clarity only: resolving it changes no implementation decision and causes no rework. | An ambiguous term where both readings build the same thing; an undefined term clear from consistent use; a missing illustrative example. | A spec says "the button should be prominent" while the design system already enforces a primary-button style. |
