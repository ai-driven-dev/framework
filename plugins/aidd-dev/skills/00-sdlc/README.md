← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 00 - sdlc

Pure orchestrator for the full AIDD development flow. Takes a free-form request
from idea to shipped code by composing the other skills in this plugin (and any
VCS-providing capabilities loaded at runtime, e.g. commit and pull-request).
Holds no business logic of its own; every step is delegated.

## When to use

- A human (or upstream orchestrator) hands over a free-form request and you
  need to drive it end-to-end: spec, plan, implement, review, ship.
- You want the default autonomous run (`auto` mode) with no human prompts.
- You want the same flow but with confirmation gates (`interactive` mode).

## When NOT to use

- A single SDLC step is enough → call that skill directly
  ([01-plan](../01-plan/README.md), [02-implement](../02-implement/README.md),
  [05-review](../05-review/README.md), etc.).
- You need to audit, refactor, debug, test, or assert outside of a shipping
  pipeline → see [04-audit](../04-audit/README.md),
  [07-refactor](../07-refactor/README.md), [08-debug](../08-debug/README.md),
  [06-test](../06-test/README.md), [03-assert](../03-assert/README.md).
- The task has an explicit retry-until-success contract → use
  [09-for-sure](../09-for-sure/README.md).

## How to invoke

```
/sdlc <request>                # auto mode (default)
/sdlc interactive <request>    # pauses at each gate for human confirmation
```

The skill walks 5 actions:

1. `spec` - consolidate sources, draft or refine the contract (skippable if
   the source ticket already carries objective + acceptance criteria).
2. `plan` - produce the mandatory plan file by running `aidd-dev:01-plan` in
   the orchestrator's own context (it owns the plan).
3. `implement` - loop milestones via the `executor` agent until complete.
4. `review` - verdict `ship` or `iterate` via the `checker` agent; on
   `iterate`, loop back to step 3 with findings.
5. `ship` - commit and open the pull request.

## Outputs

- A spec file (unless skipped).
- A plan file in `aidd_docs/tasks/`.
- Atomic commits on the active branch, one per phase.
- A pull request with title, body, base branch, and draft state.
- Findings + completion + quality scores from the checker.

## Prerequisites

- HEAD is on a non-default branch when the run is meant to ship. `05-ship`
  aborts with `contract_violation: on_default_branch` otherwise.
- The `executor` and `checker` agents are available.
- A VCS-providing capability is loaded at runtime for the ship step
  (commit + pull-request creation).

## Technical details

See [`SKILL.md`](SKILL.md) for the orchestration contract, the iron rule
("you are the conductor, not a player"), the mode detection logic, and the
five interactive gate definitions. Per-action contracts live in
[`actions/`](actions/).
