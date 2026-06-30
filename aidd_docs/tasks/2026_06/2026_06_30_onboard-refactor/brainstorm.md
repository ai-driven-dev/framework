# Brainstorm — onboard refactor

> Refined through brainstorm. Intent-level only: no solution, no plan.

## Refined idea

Onboard stays a **guide** that orients the user in the AIDD flow and never builds the work itself. The refactor reshapes it around four moves:

- **Foundation first.** When the project's memory bank is missing or unsynced, onboard makes setting it up (init, sync) the loud, pre-selected next step. It is **skippable** — the user can override — so the existing "suggest, never force" principle survives; the right path is just made obvious.
- **Project-adapted action menu.** Once the foundation is in place or skipped, onboard offers a *set* of relevant next actions (refine an idea, plan, audit, debug, …) instead of one lone suggestion.
- **Two-layer relevance.** The menu is built from what the installed plugins *can* do, then ranked by *cheap* project signals for what the project *needs now*. Deep analysis is **not** onboard's job — the capability the user picks does its own deep work.
- **Lighter loop.** Onboard reads the project once and refreshes only on change, rather than a full rescan every loop.

A **capability reference** underpins this: it maps installed plugins to the actions they offer — the raw material onboard ranks against the cheap project signals.

## Settled this round

- Role: guide, not actor (same job as today).
- Enforce strength: strong default, skippable — not a hard gate.
- Reference model: possible (plugin capability map) × relevant (codebase-signal ranking).
- Loop reads: read once, refresh on change.
- Analysis depth (leaning, not locked): cheap signals only; the picked capability owns the deep analysis.

## Open assumptions (confirm at design time)

1. **Skip semantics** — how the user skips the foundation step, and whether onboard re-nags it next loop or remembers the skip.
2. **Signal set** — the exact cheap signals feeding the ranking (manifest, presence of tests/specs/plans/open PRs, memory state, …); ordering is heuristic by design.
3. **Reference shape** — evolve the existing journey map vs introduce a new capability reference (a build-time call).
4. **"On change" trigger** — what counts as a state change that forces a re-read.
5. **Foundation scope** — just memory init + sync, or also the AI context files?
6. **Menu rules** — which actions surface, and how they are ordered and capped.

## Next move

Ready to become a **design / plan for the onboard skill**, then built.
