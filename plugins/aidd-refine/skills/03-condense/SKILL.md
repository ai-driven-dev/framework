---
name: 03-condense
description: Toggle terse output mode with intensity levels (lite, full, ultra) so prose drops articles, filler, and pleasantries while code, quoted errors, and security warnings stay verbatim. Also reports real token usage and estimated savings under condense mode for the current session. Use when the user says "condense", "condense output", "be more concise", "shorter answers", "tighten output", "/condense", "/condense full", "/condense ultra", "stop condense", "normal mode", "/condense-stats", "how much have we saved", or "token savings". Do NOT use for editing existing prose, summarizing a long document, or compressing source code (only output style is affected, not content).
---

# Condense

Toggles a terse output mode with three intensity levels (lite, full, ultra). Strips articles, filler, and pleasantries from prose while preserving technical substance, code blocks, quoted errors, and security warnings.

## Available actions

| #   | Action     | Role                                                                  | Input                                |
| --- | ---------- | --------------------------------------------------------------------- | ------------------------------------ |
| 01  | `condense` | Toggle terse mode and apply intensity rules                           | current_state + requested_intensity  |
| 02  | `stats`    | Report real token usage and estimated savings for the current session | session log + intensity timeline     |

## Default flow

Router dispatches by intent:

- Toggle phrase or intensity command (`condense`, `/condense full`, `stop condense`, `normal mode`, ...) → `01-condense`
- Stats query (`/condense-stats`, `how much have we saved`, `token savings`, ...) → `02-stats`

## Transversal rules

- **Persistence**: once active, terse mode applies to EVERY response until explicitly turned off. Do not drift back to verbose prose after many turns, when uncertain, or when the task changes. The level remains active for the rest of the session unless changed or stopped.
- **Off switch**: terse mode stops only on explicit user signal - `stop condense`, `normal mode`, `/condense off`, or invoking the skill again to toggle.
- **Toggle**: invoking the skill while active toggles it off; invoking while off turns it on at the default level (`full`) unless an explicit intensity is given.
- **Drop fluff**: drop articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), and hedging. Fragments are acceptable.
- **Short synonyms**: prefer short words (big not extensive, fix not "implement a solution for"). Technical terms stay exact. Code blocks are unchanged. Errors are quoted verbatim.
- **Pattern**: `[thing] [action] [reason]. [next step].`
  - Bad: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
  - Good: "Bug in auth middleware. Token expiry check uses `<` not `<=`. Fix:"
- **Auto-pause** (drop terse mode for these passages, then resume): security warnings, irreversible action confirmations, multi-step sequences where fragment order or omitted conjunctions risk misread, compression itself creating technical ambiguity, user asks to clarify or repeats a question.
- **Boundaries**: code, commits, and pull request bodies are written in normal English regardless of intensity. The intensity level persists until toggled off or until session end.

## References

- `@references/intensity-levels.md`: detailed per-level rules and side-by-side examples.

## Assets

- None.

## External data

- `../hooks/condense-stats.js` - UserPromptSubmit hook that intercepts stats triggers, reads the session transcript, and returns the formatted savings report without invoking the model.
