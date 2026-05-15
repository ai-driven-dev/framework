← [aidd-framework](../../../../README.md) / [aidd-refine](../../README.md)

# 02 - Challenge

Rethinks just-completed work against an agreed plan, surfaces what is wrong,
missing, or duplicated, and classifies each finding as deal-breaker,
suggestion, or correct. Outputs a confidence score so the user knows whether
to ship, iterate, or rework.

## When to use

- The user says "challenge this", "rethink your plan", "is this correct",
  "review my last decision", "challenge my decision", "challenge what you
  did", "is my decision right", "criticize this", or "find flaws".
- A critical review of just-completed work is requested before shipping.
- A decision needs adversarial scrutiny before being committed to.

## When NOT to use

- Line-by-line code review against a style guide.
- Implementing features, writing tests, or generating new code.
- Reviewing a plan that has not yet been written.

## How to invoke

```
Use skill aidd-refine:02:challenge
```

The skill is single-action - the router dispatches to `challenge` whenever
the trigger phrases above appear.

1. `challenge` - rethink prior work, classify findings, score confidence
   against the agreed plan.

## Outputs

- A structured verdict report with three classified buckets:
  - **Deal-breakers** - issues that block shipping.
  - **Suggestions** - improvements that are not blockers.
  - **Correct** - explicit acknowledgement of what is already right.
- A confidence percentage based on the tiered rubric.
- No code edits. The report is informational; the user decides what to act on.

## Prerequisites

- A piece of recently completed work (plan, decision, implementation, diff)
  to challenge.
- An agreed reference point (plan, spec, decision record) to challenge it
  against. Without one, the skill challenges against stated user intent.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for
the single step, and
[`references/confidence-rubric.md`](references/confidence-rubric.md) for the
tiered rubric backing the confidence percentage.
