← [aidd-framework](../../../../README.md) / [aidd-refine](../../README.md)

# 05 - Fact-check

Verifies the factual claims inside a target text and rewrites it grounded in
evidence. Each verifiable claim is extracted, classified, and checked against a
cheapest-first cascade (project memory and docs, then codebase inspection, then
web lookup). The rewritten answer carries a footnote citation on every confirmed
claim, an explicit hedge on every unconfirmed claim, and both sources whenever
they disagree.

## When to use

- The user asks to "fact-check this", "verify that claim", "are you sure", "is
  that actually true", "cite your sources", or "where did you get that fact".
- A prior answer states versions, API behavior, dates, or repository facts that
  must be confirmed before being trusted.
- The user wants a clear separation between what is sourced and what is a guess.

## When NOT to use

- To auto-guard the AI's own output - this skill only fires on an explicit
  request. A permanent "always verify" guard belongs in an always-loaded rule.
- To judge code logic correctness or review code style.
- To clarify vague requirements through iterative Q&A - use the
  `aidd-refine:01:brainstorm` skill.

## How to invoke

```
Use skill aidd-refine:05:fact-check
```

Provide the text to check - the prior answer, a quoted passage, or a pasted
block:

```
Use skill aidd-refine:05:fact-check on <text or path>
```

The skill runs a fixed three-step pipeline:

1. `identify-claims` - extract verifiable claims, classify each, drop opinion.
2. `verify` - run the cascade per claim, assign a verdict and record sources.
3. `report` - rewrite the text with footnote citations, hedge unverified
   claims, and surface conflicts with both sources.

## Outputs

- The rewritten answer with a `[n]` marker on every verified claim.
- A `## Sources` footnote block - one numbered entry per source.
- A `## Unverified claims` section listing every claim the cascade could not
  resolve (omitted when none).
- An optional cache suggestion for stable verified facts, opt-in only.

## Prerequisites

- A piece of text whose claims need checking.
- Project memory, docs, and codebase available for the cheap cascade tiers; a
  web lookup tool for the last-resort tier.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract and transversal rules.
Action implementations are under [`actions/`](actions/).
The claim taxonomy and the verification cascade live in
[`references/`](references/).
The rewritten-answer skeleton is at
[`assets/report-template.md`](assets/report-template.md).
