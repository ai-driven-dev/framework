---
name: aidd-refine:03:condense
description: Toggle terse output mode with intensity levels (lite, full, ultra) so prose drops articles, filler, and pleasantries while code, quoted errors, and security warnings stay verbatim. Use when the user says "condense", "condense output", "be more concise", "shorter answers", "tighten output", "/condense", "/condense full", "/condense ultra", or "stop condense". Do NOT use for editing existing prose, summarizing a long document, or compressing source code (only output style is affected, not content).
---

# Condense

Toggles a terse output mode with three intensity levels (lite, full, ultra). Strips articles, filler, and pleasantries from prose while preserving technical substance, code blocks, quoted errors, and security warnings.

## Available actions

| #   | Action     | Role                                                | Input                                       |
| --- | ---------- | --------------------------------------------------- | ------------------------------------------- |
| 01  | `condense` | Toggle terse mode and apply intensity rules         | current_state + requested_intensity         |

## Default flow

Single action skill. The router dispatches to `condense` whenever a toggle phrase or intensity command appears.

## Transversal rules

- **Toggle**: invoking the skill while active turns it off and restores normal communication; invoking while off turns it on.
- **Drop fluff**: drop articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), and hedging. Fragments are acceptable.
- **Short synonyms**: prefer short words (big not extensive, fix not "implement a solution for"). Technical terms stay exact. Code blocks are unchanged. Errors are quoted verbatim.
- **Pattern**: `[thing] [action] [reason]. [next step].`
- **Auto-pause**: drop terse mode for security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread, or when the user is confused. Resume once the at-risk passage is clear.
- **Boundaries**: code, commits, and pull request bodies are written in normal English regardless of intensity. The intensity level persists until toggled off or until session end.

## References

- `references/intensity-levels.md`: detailed per-level rules and side-by-side examples.

## Assets

- None.

## External data

- None.
