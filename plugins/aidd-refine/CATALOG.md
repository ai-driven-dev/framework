# aidd-refine catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-refine` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`hooks`](#hooks)
  - [`hooks/lib`](#hookslib)
- [`skills`](#skills)
  - [`skills/01-brainstorm`](#skills01-brainstorm)
  - [`skills/02-challenge`](#skills02-challenge)
  - [`skills/03-shadow-areas`](#skills03-shadow-areas)
  - [`skills/04-fact-check`](#skills04-fact-check)
  - [`skills/05-review-conversation`](#skills05-review-conversation)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `hooks`

| File |
|------|
| [artifacts.cjs](hooks/artifacts.cjs) |
| [hooks.json](hooks/hooks.json) |

#### `hooks/lib`

| File |
|------|
| [host.cjs](hooks/lib/host.cjs) |

### `skills`

#### `skills/01-brainstorm`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-capture.md](skills/01-brainstorm/actions/01-capture.md) | - |
| `actions` | [02-explore.md](skills/01-brainstorm/actions/02-explore.md) | - |
| `actions` | [03-conclude.md](skills/01-brainstorm/actions/03-conclude.md) | - |
| `assets` | [discovery-brief.md](skills/01-brainstorm/assets/discovery-brief.md) | - |
| `references` | [discovery-map.md](skills/01-brainstorm/references/discovery-map.md) | - |
| `references` | [persistence.md](skills/01-brainstorm/references/persistence.md) | - |
| `references` | [probing.md](skills/01-brainstorm/references/probing.md) | - |
| `scripts` | [contract.json](skills/01-brainstorm/scripts/contract.json) | - |
| `scripts` | [validate-brainstorm.cjs](skills/01-brainstorm/scripts/validate-brainstorm.cjs) | - |
| `-` | [SKILL.md](skills/01-brainstorm/SKILL.md) | `Clarifies a vague idea through questions, when the user has a half-formed idea or asks to brainstorm, refine or clarify one.` |

#### `skills/02-challenge`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-challenge.md](skills/02-challenge/actions/01-challenge.md) | - |
| `assets` | [report-template.md](skills/02-challenge/assets/report-template.md) | - |
| `references` | [decision.md](skills/02-challenge/references/decision.md) | - |
| `references` | [techniques.md](skills/02-challenge/references/techniques.md) | - |
| `scripts` | [contract.json](skills/02-challenge/scripts/contract.json) | - |
| `scripts` | [validate-challenge.cjs](skills/02-challenge/scripts/validate-challenge.cjs) | - |
| `-` | [SKILL.md](skills/02-challenge/SKILL.md) | `Challenges finished work and what it was asked to do, when the user wants to know what breaks it before relying on it.` |

#### `skills/03-shadow-areas`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-scan.md](skills/03-shadow-areas/actions/01-scan.md) | - |
| `actions` | [02-report.md](skills/03-shadow-areas/actions/02-report.md) | - |
| `assets` | [report-template.md](skills/03-shadow-areas/assets/report-template.md) | - |
| `references` | [categories.md](skills/03-shadow-areas/references/categories.md) | - |
| `references` | [lenses.md](skills/03-shadow-areas/references/lenses.md) | - |
| `scripts` | [contract.json](skills/03-shadow-areas/scripts/contract.json) | - |
| `scripts` | [validate-shadow-areas.cjs](skills/03-shadow-areas/scripts/validate-shadow-areas.cjs) | - |
| `-` | [SKILL.md](skills/03-shadow-areas/SKILL.md) | `Finds what a written idea, story, PRD or spec leaves unsaid, when the user wants its gaps as questions before building on it.` |

#### `skills/04-fact-check`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-identify-claims.md](skills/04-fact-check/actions/01-identify-claims.md) | - |
| `actions` | [02-verify.md](skills/04-fact-check/actions/02-verify.md) | - |
| `actions` | [03-report.md](skills/04-fact-check/actions/03-report.md) | - |
| `assets` | [report-template.md](skills/04-fact-check/assets/report-template.md) | - |
| `references` | [claim-categories.md](skills/04-fact-check/references/claim-categories.md) | - |
| `references` | [report-output-discipline.md](skills/04-fact-check/references/report-output-discipline.md) | - |
| `references` | [verification-cascade.md](skills/04-fact-check/references/verification-cascade.md) | - |
| `-` | [SKILL.md](skills/04-fact-check/SKILL.md) | `Verify factual claims in a text against authoritative sources and rewrite it with footnote citations, hedging the unconfirmed. Use to fact-check, verify a claim, or cite sources on request. Not for judging code or clarifying requirements.` |

#### `skills/05-review-conversation`

| Group | File | Description |
|-------|------|---|
| `actions` | [01-read-conversation.md](skills/05-review-conversation/actions/01-read-conversation.md) | - |
| `actions` | [02-recommend.md](skills/05-review-conversation/actions/02-recommend.md) | - |
| `actions` | [03-target-edits.md](skills/05-review-conversation/actions/03-target-edits.md) | - |
| `assets` | [report.js](skills/05-review-conversation/assets/report.js) | - |
| `assets` | [session-review-brief.md](skills/05-review-conversation/assets/session-review-brief.md) | - |
| `references` | [conversation-sources.md](skills/05-review-conversation/references/conversation-sources.md) | - |
| `-` | [SKILL.md](skills/05-review-conversation/SKILL.md) | `Reviews a finished conversation tree for wasted time, tokens or correctness and proposes remedies grounded in evidence. Use when the user wants to diagnose a run or choose an instruction to fix. Not for delivery review or automatic edits.` |

