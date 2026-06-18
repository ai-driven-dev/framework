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
| `-` | [README.md](skills/02-challenge/README.md) | - |
| `references` | [confidence-rubric.md](skills/02-challenge/references/confidence-rubric.md) | - |
| `-` | [SKILL.md](skills/02-challenge/SKILL.md) | `Rethink prior work to verify correctness against an agreed plan, classifying findings as deal-breakers, suggestions, or correct, with a confidence score. Use when the user says "challenge this", "rethink your plan", "is this correct", "review my last decision", "challenge my decision", "challenge what you did", "is my decision right", "criticize this", "find flaws", or asks for a critical review of just-completed work. Do NOT use for line-by-line code review against a style guide, implementing features, writing tests, or generating new code.` |

#### `skills/03-condense`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-condense.md](skills/03-condense/actions/01-condense.md) | - |
| `actions` | [02-stats.md](skills/03-condense/actions/02-stats.md) | - |
| `-` | [README.md](skills/03-condense/README.md) | - |
| `references` | [intensity-levels.md](skills/03-condense/references/intensity-levels.md) | - |
| `-` | [SKILL.md](skills/03-condense/SKILL.md) | `Toggle terse output mode with intensity levels (lite, full, ultra) so prose drops articles, filler, and pleasantries while code, quoted errors, and security warnings stay verbatim. Also reports real token usage and estimated savings under condense mode for the current session. Use when the user says "condense", "condense output", "be more concise", "shorter answers", "tighten output", "/condense", "/condense full", "/condense ultra", "stop condense", "normal mode", "/condense-stats", "how much have we saved", or "token savings". Do NOT use for editing existing prose, summarizing a long document, or compressing source code (only output style is affected, not content).` |

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
| `-` | [SKILL.md](skills/04-shadow-areas/SKILL.md) | `Analytical scan of a markdown artifact (idea, user-stories, PRD, spec) to surface blind spots - unstated assumption, missing actor, missing failure mode, ambiguous term, missing acceptance criterion, missing edge case, and missing dependency - emitting a structured shadow report grouped by category and sorted by severity. Use when the user says "find blind spots in this spec", "what's missing in this PRD", "shadow report", "shadow analysis", "scan for gaps", "find what's missing", "spot blind spots", "review for gaps", or asks for an analytical gap scan of a written artifact. Do NOT use for interactive clarification through iterative Q&A (use aidd-refine:01-brainstorm for that), implementing features, writing tests, or reviewing code style.` |

#### `skills/05-fact-check`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-identify-claims.md](skills/05-fact-check/actions/01-identify-claims.md) | - |
| `actions` | [02-verify.md](skills/05-fact-check/actions/02-verify.md) | - |
| `actions` | [03-report.md](skills/05-fact-check/actions/03-report.md) | - |
| `assets` | [report-template.md](skills/05-fact-check/assets/report-template.md) | - |
| `-` | [README.md](skills/05-fact-check/README.md) | - |
| `references` | [claim-categories.md](skills/05-fact-check/references/claim-categories.md) | - |
| `references` | [verification-cascade.md](skills/05-fact-check/references/verification-cascade.md) | - |
| `-` | [SKILL.md](skills/05-fact-check/SKILL.md) | `Verify factual claims in a piece of text against authoritative sources and rewrite it with footnote citations, hedging any claim that cannot be confirmed. Runs a cheapest-first verification cascade (project memory and docs, then codebase inspection, then web lookup) and reports both sources when they disagree. Use when the user says "fact-check this", "verify that claim", "are you sure about that", "is that actually true", "cite your sources", "where did you get that fact", "did you make that up", "double-check the version you gave me", "vérifie cette information", or "es-tu sûr de ça". Do NOT use to auto-guard the AI's own output (this skill only fires on an explicit request), to judge code logic correctness, or to clarify vague requirements through iterative Q&A - use `aidd-refine:01-brainstorm` for that.` |

