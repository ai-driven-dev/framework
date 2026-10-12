---
status: pending
---

# Instruction: verify-rules

## Architecture projection

```txt
plugins/aidd-qa/skills/01-acceptance-qa/             ✏️ one clause per rule, where the decision is made
```

## Acceptance criteria

- One happy path per journey: a spec with two journeys runs both.
- A CLI criterion is verified by its command and expected output.
- Invoked by another skill or agent, it never asks: a missing decision yields `blocked` with the question.
- Test-only storage is proven before any start, by memory, an isolated fixture, or the user; an environment name is not proof.
- A crashed or UI-less entry gets one documented fallback, else `blocked`.
- Viewport and permissions come from the criterion, then `Browser QA` memory, then the default.
- A vague criterion becomes one observable condition, else it is rejected.
- A timed boundary is probed on both sides; measured values reach `Actual`.
- A short transition is measured inside `run-code`.
- Destructive means data outside the scenario's fixture or an irreversible external effect.
- `qa.md` holds `Limitations`; a limitation that weakens proof yields `blocked`.
