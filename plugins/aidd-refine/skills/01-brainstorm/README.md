← [aidd-framework](../../../../README.md) / [aidd-refine](../../README.md)

# 01 - Brainstorm

Interactive brainstorming session that clarifies and refines a vague request
through iterative questioning, until no ambiguity remains and the user
explicitly approves the result.

## When to use

- The user surfaces an unclear requirement, a half-formed idea, or a fuzzy
  feature description.
- A request feels under-specified and the next step (plan, code, test) would
  rest on assumptions.
- The user explicitly asks to brainstorm, refine, or clarify a request.

## When NOT to use

- The technical spec is already clear and actionable.
- The user only needs implementation details on a settled requirement.
- The request is concrete enough that planning or coding can start directly.

## How to invoke

```
Use skill aidd-refine:01-brainstorm
```

The skill walks 5 atomic actions:

1. `capture-request` - restate the initial intent as bullet points.
2. `ask-probing-questions` - challenge assumptions with targeted questions.
3. `integrate-answers` - fold the user's answers back into the request.
4. `refine-and-validate` - finalize and scan for residual ambiguity.
5. `confirm-approval` - wait for explicit user sign-off.

The router loops `02 → 03` until the validator marks the request unambiguous.

## Outputs

- A refined, bullet-pointed request the user has explicitly approved.
- No code, no plan, no files. Intent only.

## Prerequisites

- A user-supplied request, even if vague.
- Willingness to answer clarifying questions before moving forward.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for
each step, [`references/ambiguity-detection.md`](references/ambiguity-detection.md)
for the ambiguity heuristics, and
[`assets/question-templates.md`](assets/question-templates.md) for the reusable
question categories.
