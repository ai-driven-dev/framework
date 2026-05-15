---
name: aidd-pm:04:spec
description: Generate or refine a project spec from a free-form human request, an existing PRD, or reviewer findings. Use when the user says "draft spec", "spec for X", "refine the spec", "generate spec from prd", "/spec", or when an orchestrator needs a normalized contract before planning. Do NOT use for writing source code, drafting a full PRD, or modifying a validated and locked spec.
---

# Spec

Generates or refines the immutable contract between human intent and downstream agents.

## Available actions

| #   | Action    | Role                                                              | Input                                  |
| --- | --------- | ----------------------------------------------------------------- | -------------------------------------- |
| 01  | `build`   | Create a fresh spec from a free-form request or an existing PRD    | request or prd_path, feature_name      |
| 02  | `refine`  | Rewrite an existing spec to address reviewer findings              | existing_spec, findings                |

## Default flow

Non-sequential. The router dispatches based on inputs:

- `existing_spec` and `findings` present -> `refine`
- `request` or `prd_path` present -> `build`

## Transversal rules

- Never invent missing information. Mark every gap as `TBD: <precise question>` instead of guessing.
- If the request is too vague to draft a useful spec, return early and ask the user to brainstorm the request first; do not fabricate intent.
- Never modify a spec that has been validated and locked.
- The spec is the contract; it is immutable once validated.
- Keep the spec readable: clear section headers, bulleted criteria, explicit non-goals.
- Never include implementation detail (libraries, patterns, file layout); those belong to the plan.
- Do not self-validate. The caller spawns a reviewer with `assets/spec-validator.yml`; findings come back through the `refine` action for the next iteration.

## References

- None.

## Assets

- `assets/spec-template.md`: canonical structure of a spec.
- `assets/spec-validator.yml`: checklist used by the reviewer to validate a spec.

## External data

- None.
