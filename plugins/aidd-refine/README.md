← [aidd-framework](../../README.md)

# aidd-refine

Meta-cognition plugin for the AI-Driven Development framework.

> Status: stable.

First time? Install with `/plugin install aidd-refine@aidd-framework`, then run `aidd-refine:01-brainstorm`.

Five skills that refine inputs and outputs through reflection: clarify vague requests, challenge prior work for correctness, toggle a condensed output mode, analytically scan artifacts for blind spots, and verify factual claims against authoritative sources.

## Skills

| Bracket ID | Skill      | Description                                                                                                                                                                                   |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [5.1]      | [brainstorm](skills/01-brainstorm/README.md) | Clarify a vague request with targeted questions across six clarity dimensions, until it is precise or the user is satisfied.                            |
| [5.2]      | [challenge](skills/02-challenge/README.md)  | Recheck prior work against the agreed plan and score each finding's confidence.                                                                                |
| [5.3]      | [condense](skills/03-condense/README.md)   | Toggle a terse output mode that trims prose while keeping code, errors, and warnings verbatim.                                                                           |
| [5.4]      | [shadow-areas](skills/04-shadow-areas/README.md) | Scan a written artifact for blind spots. Each gap gets a category, a severity, and a direct-question probe.                                              |
| [5.5]      | [fact-check](skills/05-fact-check/README.md) | Verify factual claims against authoritative sources, add footnote citations, and hedge anything unconfirmed.                                              |
