# Review: Delivery loop router

- Rounds: 1
- Started: 2026-10-20

## Round 1 · r-420a

- Date: 2026-10-20
- By: Sebastien Giband
- Diff: `da3a99c5903f911df5e4e6201d946a28c7937efd...82ca178b1c1f3d936849a705d2709c70c525f840`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 3/4 met, 1 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Phase 1, routing has one detailed source and a route action — `actions/route.md:13-15` loads `references/routing.md`; the root has no signal rules.
- [x] Phase 1, root and selected mode boundaries preserve action order and dynamic discovery — `SKILL.md:9-33`, `actions/setup.md`, `actions/run.md`, `actions/review.md`, and unchanged `actions/run/04-check-sdlc.md`.
- [ ] Phase 2, routing parity is guarded for explicit arguments, CI labels and comment aliases, repo state, natural language, tie breaks, conflicts, and unresolved signals — `scripts/__tests__/async-dev-router.test.js:25-35` only checks that words occur in the reference. No input scenario selects a mode or checks an expected outcome.
- [x] Phase 2, before and after path counts and checks are recorded — `evidence.md:1-28` gives the inclusion rule, revision procedure, and 424 → 365 shortest / 796 → 751 longest totals.

### Findings

- `plugins/aidd-orchestrator/skills/00-async-dev/actions/route.md:15` : it says a conflicting request always stops before loading a mode, while `references/routing.md:89-92` explicitly routes two conflict cases to `review`; two agents can choose different outcomes for the same webhook → distinguish blocking conflicts from resolved conflict overrides, and make the route action defer to the reference's resolved mode — 🟡 major, architecture
- `scripts/__tests__/async-dev-router.test.js:25` : the routing test proves only that strings exist, so a changed precedence or lost alias behavior would still pass; the plan requires exercised input cases → test the decision outcomes for each signal class and conflict, or provide a deterministic resolver that the scenarios can invoke — 🟡 major, code-health
