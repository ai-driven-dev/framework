# aidd-refine catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-refine` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`skills`](#skills)
  - [`skills/01-brainstorm`](#skills01-brainstorm)
  - [`skills/02-challenge`](#skills02-challenge)
  - [`skills/03-condense`](#skills03-condense)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `skills`

#### `skills/01-brainstorm`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture-request.md](skills/01-brainstorm/actions/01-capture-request.md) | - |
| `actions` | [02-ask-probing-questions.md](skills/01-brainstorm/actions/02-ask-probing-questions.md) | - |
| `actions` | [03-integrate-answers.md](skills/01-brainstorm/actions/03-integrate-answers.md) | - |
| `actions` | [04-refine-and-validate.md](skills/01-brainstorm/actions/04-refine-and-validate.md) | - |
| `actions` | [05-confirm-approval.md](skills/01-brainstorm/actions/05-confirm-approval.md) | - |
| `assets` | [question-templates.md](skills/01-brainstorm/assets/question-templates.md) | - |
| `evals` | [scenarios.json](skills/01-brainstorm/evals/scenarios.json) | - |
| `references` | [ambiguity-detection.md](skills/01-brainstorm/references/ambiguity-detection.md) | - |
| `-` | [SKILL.md](skills/01-brainstorm/SKILL.md) | `Interactive brainstorming session to clarify and refine requests through iterative questioning. Use when user mentions unclear requirements, vague ideas, or needs clarification on features. Do NOT use for clear technical specs, implementation details, or when requirements are already well-defined.` |

#### `skills/02-challenge`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-challenge.md](skills/02-challenge/actions/01-challenge.md) | - |
| `evals` | [scenarios.json](skills/02-challenge/evals/scenarios.json) | - |
| `references` | [confidence-rubric.md](skills/02-challenge/references/confidence-rubric.md) | - |
| `-` | [SKILL.md](skills/02-challenge/SKILL.md) | `Rethink prior work to verify correctness against an agreed plan, classifying findings as deal-breakers, suggestions, or correct, with a confidence score. Use when the user says "challenge this", "rethink your plan", "is this correct", "review my last decision", "challenge my decision", "challenge what you did", "is my decision right", "criticize this", "find flaws", or asks for a critical review of just-completed work. Do NOT use for line-by-line code review against a style guide, implementing features, writing tests, or generating new code.` |

#### `skills/03-condense`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-condense.md](skills/03-condense/actions/01-condense.md) | - |
| `evals` | [scenarios.json](skills/03-condense/evals/scenarios.json) | - |
| `references` | [intensity-levels.md](skills/03-condense/references/intensity-levels.md) | - |
| `-` | [SKILL.md](skills/03-condense/SKILL.md) | `Toggle terse output mode with intensity levels (lite, full, ultra) so prose drops articles, filler, and pleasantries while code, quoted errors, and security warnings stay verbatim. Use when the user says "condense", "condense output", "be more concise", "shorter answers", "tighten output", "/condense", "/condense full", "/condense ultra", or "stop condense". Do NOT use for editing existing prose, summarizing a long document, or compressing source code (only output style is affected, not content).` |

