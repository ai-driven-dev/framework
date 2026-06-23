---
name: 00-sdlc
description: Orchestrate the full dev flow from a free-form request to shipped code: spec, plan, implement, review, ship, every step delegated. Use to take a request end to end to a change request, not a single step. Interactive by default (pauses at each gate); say auto for an unattended run.
argument-hint: spec | plan | implement | review | ship
---

# Skill: sdlc

Take a request from idea to shipped code, delegating every step. Interactive by default, autonomous when you say `auto`.

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
- Mode: default `interactive`, pausing for approval at each step; switch to `auto` only when the caller says so, then decide alone and never ask.
- Every step runs; only `01-spec` self-skips when the source already states an objective and acceptance criteria.
- Drive the plan status `pending → in-progress → implemented → reviewed`, or `blocked`.
- Every step writes into one feature folder resolved at entry.
- Never auto-branch; the caller sets a non-default branch before shipping.
