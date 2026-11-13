---
objective: "aidd-context:04-skill-generate emits the lean skill format, proven by regenerating 05-review and 08-hook-generate, with the home-made skill-eval removed."
status: pending
---

# Plan: skill-generate lean

## Overview

| Field      | Value                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| **Goal**   | Generator emits lean skills; two skills regenerated through it          |
| **Source** | [brainstorm.md](./brainstorm.md), Track A only; the validation engine is out of scope |

## Phases

| #   | Phase                                   | File                         |
| --- | --------------------------------------- | ---------------------------- |
| 1   | Rewrite the generator to the lean format | [`phase-1.md`](./phase-1.md) |
| 2   | Regenerate 05-review and 08-hook-generate | [`phase-2.md`](./phase-2.md) |
| 3   | Remove skill-eval, fix testing.md       | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | description limit, one-level references, validate-fix-repeat loop |
| https://code.claude.com/docs/en/skills | description budget, `disable-model-invocation`, `hooks` frontmatter |

## Decisions

| Decision | Why |
| -------- | --- |
| Generator fixed on mismatch, never the regenerated output | the generator is the product under test |
| `## Transversal rules` kept, `## Test` and evals template dropped | user decision; `Done when` is the Output |
| `04-validate` loop is a Process step, runtime trial kept optional | docs recommend validate, fix, repeat |
