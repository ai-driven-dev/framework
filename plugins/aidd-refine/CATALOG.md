# aidd-refine catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-refine` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
- [`skills`](#skills)
  - [`skills/01-brainstorm`](#skills01-brainstorm)
  - [`skills/02-challenge`](#skills02-challenge)
  - [`skills/03-condense`](#skills03-condense)
  - [`skills/04-shadow-areas`](#skills04-shadow-areas)
  - [`skills/05-fact-check`](#skills05-fact-check)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `hooks`

| File |
|------|
| [condense-stats.js](hooks/condense-stats.js) |
| [hooks.json](hooks/hooks.json) |

### `skills`

#### `skills/01-brainstorm`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture.md](skills/01-brainstorm/actions/01-capture.md) | - |
| `actions` | [02-probe.md](skills/01-brainstorm/actions/02-probe.md) | - |
| `actions` | [03-integrate.md](skills/01-brainstorm/actions/03-integrate.md) | - |
| `actions` | [04-finalize.md](skills/01-brainstorm/actions/04-finalize.md) | - |
| `assets` | [question-angles.md](skills/01-brainstorm/assets/question-angles.md) | - |
| `-` | [README.md](skills/01-brainstorm/README.md) | - |
| `references` | [probing.md](skills/01-brainstorm/references/probing.md) | - |
| `-` | [SKILL.md](skills/01-brainstorm/SKILL.md) | `Clarify a vague idea through deep back-and-forth questioning until it is precise enough to act on. Works at any level, functional, technical, or mixed. Use when the user surfaces a half-formed idea, a fuzzy feature, a technical question, or an under-specified request, or asks to brainstorm, clarify, or refine before committing. Keeps probing and following each answer's threads until no real ambiguity remains or the user is satisfied. Not for analytically scanning a written artifact for gaps (use aidd-refine:04-shadow-areas), critiquing finished work (use aidd-refine:02-challenge), or any implementation, planning, or code.` |

#### `skills/02-challenge`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-challenge.md](skills/02-challenge/actions/01-challenge.md) | - |
| `assets` | [report-template.md](skills/02-challenge/assets/report-template.md) | - |
| `-` | [README.md](skills/02-challenge/README.md) | - |
| `references` | [confidence-rubric.md](skills/02-challenge/references/confidence-rubric.md) | - |
| `-` | [SKILL.md](skills/02-challenge/SKILL.md) | `Rethink just-completed work against an agreed plan, classify findings as deal-breakers, suggestions, or correct, with a confidence score. Use to challenge a decision, criticize, or critically review recent work; not for line-by-line style review or writing code.` |

#### `skills/03-condense`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-condense.md](skills/03-condense/actions/01-condense.md) | - |
| `actions` | [02-stats.md](skills/03-condense/actions/02-stats.md) | - |
| `-` | [README.md](skills/03-condense/README.md) | - |
| `references` | [intensity-levels.md](skills/03-condense/references/intensity-levels.md) | - |
| `-` | [SKILL.md](skills/03-condense/SKILL.md) | `Toggle terse output mode (lite, full, ultra) that drops filler while code, errors, and warnings stay verbatim, and report token savings for the session. Use to condense output, shorten answers, switch intensity, or check savings; not for editing prose or compressing code.` |

#### `skills/04-shadow-areas`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-detect.md](skills/04-shadow-areas/actions/01-detect.md) | - |
| `actions` | [02-render-report.md](skills/04-shadow-areas/actions/02-render-report.md) | - |
| `actions` | [03-diff.md](skills/04-shadow-areas/actions/03-diff.md) | - |
| `assets` | [report-template.md](skills/04-shadow-areas/assets/report-template.md) | - |
| `-` | [README.md](skills/04-shadow-areas/README.md) | - |
| `references` | [categories.md](skills/04-shadow-areas/references/categories.md) | - |
| `references` | [locked-sets.json](skills/04-shadow-areas/references/locked-sets.json) | - |
| `references` | [probe-style.md](skills/04-shadow-areas/references/probe-style.md) | - |
| `references` | [severity-rubric.md](skills/04-shadow-areas/references/severity-rubric.md) | - |
| `-` | [SKILL.md](skills/04-shadow-areas/SKILL.md) | `Scan a markdown artifact (idea, user stories, PRD, spec) for blind spots and emit a structured shadow report grouped by category and sorted by severity. Use to find gaps, missing parts, or what's missing in a written artifact; not for interactive Q&A (use aidd-refine:01-brainstorm) or code review.` |

#### `skills/05-fact-check`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-identify-claims.md](skills/05-fact-check/actions/01-identify-claims.md) | - |
| `actions` | [02-verify.md](skills/05-fact-check/actions/02-verify.md) | - |
| `actions` | [03-report.md](skills/05-fact-check/actions/03-report.md) | - |
| `assets` | [report-template.md](skills/05-fact-check/assets/report-template.md) | - |
| `-` | [README.md](skills/05-fact-check/README.md) | - |
| `references` | [claim-categories.md](skills/05-fact-check/references/claim-categories.md) | - |
| `references` | [report-output-discipline.md](skills/05-fact-check/references/report-output-discipline.md) | - |
| `references` | [verification-cascade.md](skills/05-fact-check/references/verification-cascade.md) | - |
| `-` | [SKILL.md](skills/05-fact-check/SKILL.md) | `Verify factual claims in a text against authoritative sources and rewrite it with footnote citations, hedging anything unconfirmed. Use to fact-check, verify a claim, or cite sources on explicit request; not for judging code logic or clarifying vague requirements (use aidd-refine:01-brainstorm).` |

