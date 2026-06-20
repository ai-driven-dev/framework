---
name: 00-sdlc
description: Pure orchestrator for the full AIDD development flow. Use when a human (or Gardener) needs to take a free-form request from idea to shipped code, end-to-end. Coordinates spec generation, planning, implementation, review, and shipping by composing other skills and agents. Supports two modes - `auto` (default, no human interaction) and `interactive` (pauses for human confirmation at key gates). Holds no business logic of its own; every step is delegated.
argument-hint: spec | plan | implement | review | ship
---

# Skill: sdlc

Complete end-to-end software delivery. Defaults to autonomous; switches to interactive on demand.

## Iron rule

**You are the conductor, not a player.**

You orchestrate skills and agents; you never write code yourself.

You call agents by role:

- `planner` - when scope must be planned
- `implementer` - when code must be written
- `reviewer` - when completed work must be verified

## Mandatory steps (enforce - never skip)

The flow has exactly ONE skippable step. Every other step is MANDATORY: it runs on every host (including weak-model hosts), in every mode (including `auto`), and for every change (including trivial ones).

- `01-spec` - the ONLY skippable step, and only when the source ticket already carries an explicit objective + acceptance criteria (it then returns `spec_status = skipped`).
- `02-plan`, `03-implement`, `04-review`, `05-ship` - MANDATORY. Never skip, never collapse two into one, never declare the run done with one missing. Skipping any of them is a FAILED run, not a shortcut.

Enforcement (self-check, not optional):

- A mandatory step closes only when its `## Test` passes and its artifact exists: a plan file (02), implemented + validated milestones (03), a `04-review` verdict on the final diff (04), an opened change request (05).
- **`04-review` is non-negotiable: code is never shipped unreviewed.** If you arrive at `05-ship` without a `04-review` verdict on the final diff, STOP and run `04-review` first.
- Before declaring the SDLC complete, verify all four mandatory steps produced their artifact. If any is missing, the run is NOT done - resume at the missing step. Do not report success with a skipped step.

## Modes

| Mode          | Trigger                                                     | Behavior                                                                      |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `auto`        | default; `/sdlc <request>`; orchestrator invocation         | Never asks the human. All decisions yours.                                    |
| `interactive` | `/sdlc interactive <request>`; user says "interactive sdlc" | Pause at each gate listed below; wait for explicit human approval to proceed. |

Detect the mode from `$ARGUMENTS` once, at skill entry, before dispatching the first action.

## Actions

| #   | Action      | Role                                                                   | Delegate                       |
| --- | ----------- | ---------------------------------------------------------------------- | ------------------------------ |
| 01  | `spec`      | Consolidate sources, draft or refine the contract (skippable)          | spec                           |
| 02  | `plan`      | Produce the mandatory plan file                                        | plan via `planner`             |
| 03  | `implement` | Build the plan's code, every phase, until complete                     | the `implement` skill          |
| 04  | `review`    | Verdict `ship` or `iterate`                                            | review via `reviewer`          |
| 05  | `ship`      | Commit and open a change request via the project's VCS                 | commit, pull-request           |

Files: `@actions/01-spec.md` ... `@actions/05-ship.md`.

## Default flow

`01 → 02 → 03 → 04 → 05`. On `04 = iterate`, loop back to `03` with the findings as the implementer's fix list. After each action, run its `## Test` before moving to the next.

`01-spec` self-skips (returns `spec_status = skipped`) when the source ticket already carries an explicit objective + acceptance criteria. It is the ONLY skippable step. `02-plan`, `03-implement`, `04-review`, `05-ship` are mandatory and never skipped (see **Mandatory steps**).

## Interactive gates

Activate only in `interactive` mode. In `auto` mode, never pause.

1. **After `01-spec`** - show the spec (or the extracted objective + acceptance criteria when skipped); confirm contract.
2. **After `02-plan`** - show the plan; confirm scope before any code change.
3. **After `03-implement`** - show the implemented diff; confirm before review. The phase loop runs inside the delegated `implement` skill, so the gate is the whole step, not each phase.
4. **After `04-review`** - show findings and verdict; confirm ship vs iterate.
5. **Before `05-ship` opens the change request** - show title, body, base branch, draft state; confirm before creation.

If the human pushes back at a gate, route their feedback into the relevant action (spec refinement, plan revision, implementation rerun, review re-spawn) before re-proposing the next gate.

## Runtime tracking

Materialize the flow as a task list at skill entry; it MUST contain every mandatory step (02-plan, 03-implement, 04-review, 05-ship) plus 01-spec unless skipped. A task closes only when its `## Test` passes and its artifact exists; a mandatory task is never closed by skipping it.

## Rules

- In `auto` mode, you are alone and never ask the human; all decisions are yours.
- In `interactive` mode, the human owns the gate decisions; you still decide everything between gates.
- Always run `02-plan`. Minimum: frontmatter + M/C/D + rules table + phases. Never inline ticket or spec as plan.
- Skip allowed: `01-spec` only (when the source already carries objective + acceptance criteria). `02-plan`, `03-implement`, `04-review`, `05-ship` are mandatory and enforced (see **Mandatory steps**); skipping any is a failed run.
- Choose the best decision based on the facts.
- Open a change request (pull or merge request) via the project's VCS once implementation is reviewed and complete.
- **Branch discipline (caller responsibility).** SDLC runs on whatever branch is checked out when invoked; it never auto-branches. The caller (manual user or upstream orchestrator) is responsible for putting HEAD on a non-default branch before invoking SDLC when the run is meant to ship through a PR.

## References

- `spec`
- `plan`
- `implement`
- `review`
- `commit`
- `pull-request`

## Assets

- None.
