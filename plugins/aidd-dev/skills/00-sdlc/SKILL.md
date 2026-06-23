---
name: 00-sdlc
description: Pure orchestrator for the full AIDD development flow, from a free-form request to shipped code. Use when a request must go end to end: spec, plan, implement, review, ship. Runs auto by default (no human interaction) or interactive (pauses at each step). Delegates every step and holds no logic of its own. Do NOT use to run one step in isolation; call that step's skill directly.
argument-hint: spec | plan | implement | review | ship
---

# Skill: sdlc

Take a request from idea to shipped code, delegating every step. Autonomous by default, interactive on demand.

## Actions

| #   | Action      | Role                                  | Delegate                                |
| --- | ----------- | ------------------------------------- | --------------------------------------- |
| 01  | `spec`      | Consolidate sources into the contract | a spec capability                       |
| 02  | `plan`      | Produce the plan file                 | self, via `aidd-dev:01-plan`            |
| 03  | `implement` | Build the plan's code                 | `executor`, via `aidd-dev:02-implement` |
| 04  | `review`    | Verdict `ship` or `iterate`           | `checker`, via `aidd-dev:05-review`     |
| 05  | `ship`      | Open the change request               | a commit and change-request capability  |

Run `01 → 02 → 03 → 04 → 05`. On `04 = iterate`, loop to `03` then re-run `04`.

## Transversal rules

- Delegate every step; never write or judge code yourself.
- Mode: `auto` decides alone, `interactive` pauses for approval at each step.
- Every step runs; only `01-spec` self-skips when the source already states an objective and acceptance criteria.
- Drive the plan status `pending → in-progress → implemented → reviewed`, or `blocked`.
- Every step writes into one feature folder resolved at entry.
- Never auto-branch; the caller sets a non-default branch before shipping.
