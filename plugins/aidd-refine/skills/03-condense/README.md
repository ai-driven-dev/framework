← [aidd-framework](../../../../README.md) / [aidd-refine](../../README.md)

# 03 - Condense

Toggles a terse output mode with three intensity levels (`lite`, `full`,
`ultra`). Strips articles, filler, and pleasantries from prose while leaving
code blocks, quoted errors, and security warnings verbatim. Also reports real
token usage and estimated savings for the current session.

## When to use

- The user says "condense", "condense output", "be more concise", "shorter
  answers", "tighten output", "/condense", "/condense full", "/condense
  ultra", "stop condense", or "normal mode".
- The user asks for token-savings stats: "/condense-stats", "how much have we
  saved", "token savings".
- A long session would benefit from compressed prose without losing technical
  substance.

## When NOT to use

- Editing existing prose written by the user - only the assistant's own
  output style is affected.
- Summarizing a long document into a shorter version.
- Compressing source code, commit messages, or pull request bodies - those
  stay in normal English regardless of intensity.

## How to invoke

```
Use skill aidd-refine:03-condense
```

The router dispatches by intent:

- Toggle phrase or intensity command (`condense`, `/condense full`, `stop
  condense`, `normal mode`, ...) → `01-condense`.
- Stats query (`/condense-stats`, `how much have we saved`, `token
  savings`, ...) → `02-stats`.

## Outputs

- A toggled response mode for the rest of the session. No files are written.
- Intensity persists across turns until the user explicitly turns it off
  (`stop condense`, `normal mode`, `/condense off`) or toggles the skill
  again.
- Stats action returns a formatted report of real token usage and estimated
  savings under condense mode for the session.

## Prerequisites

- None for the toggle. The skill operates on the assistant's output style.
- Stats action expects a session transcript readable by the
  `condense-stats.js` hook.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for
both steps, and
[`references/intensity-levels.md`](references/intensity-levels.md) for
per-level rules and side-by-side examples. The stats action is backed by the
`condense-stats.js` UserPromptSubmit hook, which intercepts stats triggers,
reads the session transcript, and returns the formatted savings report
without invoking the model.
