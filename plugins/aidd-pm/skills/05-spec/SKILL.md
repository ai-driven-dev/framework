---
name: aidd-pm:05:spec
description: Generates and refines a project spec from a free-form human request. The spec is the immutable target a planner consumes. Use when starting a new run, when an existing spec needs refinement after review, or when a human wants to draft a spec collaboratively.
---

# Skill: spec

Produces a complete spec from a free-form human request. The spec is the contract between human intent and downstream agents (planner, implementer, reviewer). It is immutable once validated.

## When to use

- A human types `/spec <request>` to draft a spec
- The `aidd-dev:00:sdlc` orchestrator invokes this skill at Phase 1 of a run
- An existing spec failed reviewer validation and needs refinement based on findings

## When NOT to use

- A validated spec already exists → use it directly, no need to regenerate
- The user only wants a single requirement clarified → use `aidd-pm:04:clarity`
- The user wants a full PRD with stakeholders, OKRs, and rollout plan → use `aidd-pm:03:prd` (more granular than a spec)

## Inputs

At least one of `request`, `prd_path`, or `existing_spec` is required.

```yaml
request: <free-form human description, optional>
prd_path: <path to an existing PRD file, optional — extracted into a spec>
existing_spec: <optional path — for refinement runs>
findings: <optional — reviewer findings to address>
working_dir: <where the spec.md will be written>
```

Priority when multiple are provided:

1. `existing_spec + findings` → refinement run (rewrite to address findings)
2. `prd_path` → extract scope, target, constraints, non-goals, done-when from the PRD into a normalized spec
3. `request` → generate from scratch using the template

## Outputs

```yaml
spec_path: <path to the generated spec.md>
status: draft | refined
notes: <ambiguities, assumptions made, questions for the human>
```

## Behavior

1. **Refinement** (`existing_spec` + `findings`): load both, address each finding, rewrite the spec.
2. **PRD extraction** (`prd_path`): parse the PRD, extract target / hard constraints / non-goals / done-when into the normalized spec structure. Fields the PRD doesn't cover are marked `TBD: <precise question>`. Implementation details from the PRD (libraries, patterns, file layout) are dropped — they belong to the plan.
3. **From scratch** (`request` only): produce a draft spec from the request using `assets/spec-template.md` as the structure.
4. The spec must contain every required section listed in `assets/spec-validator.yml`. When information is missing, **mark it `TBD: <precise question>` rather than guess**. The reviewer will flag it and the human can answer in the next iteration.
5. Write the spec to `working_dir/spec.md`.
6. Return the path and status.

## Validation

This skill does not self-validate. The caller (typically `aidd-dev:00:sdlc`) spawns the `reviewer` agent with `assets/spec-validator.yml` as validator after this skill returns. The reviewer's findings are passed back to this skill for refinement if needed.

## Assets

- `assets/spec-template.md` — canonical structure of a spec
- `assets/spec-validator.yml` — checklist used by the reviewer to validate a spec

## Skills this skill may invoke

- `aidd-pm:04:clarity` (when the request needs a clarification round before drafting)

## Guardrails

- Never invent missing information. Mark gaps as `TBD: <question>` with a precise question.
- Never modify a spec that has already been validated and locked.
- Keep the spec readable: clear section headers, bulleted criteria, explicit non-goals.
- Do not include implementation details (libraries, patterns, file layout) — those belong to the plan and the implementer.
