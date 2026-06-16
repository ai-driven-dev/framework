# 01 - Scope

Decide if the surfaced information is learning-worthy, analyze it, propose destinations, and wait for user approval. Skip cleanly when nothing is learning-worthy.

## Inputs

- Conversation context covering recently implemented work, decisions, deprecations, or insights.
- Existing project memory (`aidd_docs/memory/`), decisions (`aidd_docs/internal/decisions/`), and rules.

## Outputs

One of two outcomes:

- **Skipped**: a one-line `Nothing learning-worthy detected, skipping.` and the skill exits.
- **Approved plan**: a numbered list of items, each with a category and a target destination, confirmed by the user.

```text
1. <item>  →  Memory   →  aidd_docs/memory/<file>.md
2. <item>  →  Decision →  aidd_docs/internal/decisions/<id>-<title>.md
3. <item>  →  Rule     →  <project rules location>/<file>.md
```

## Process

1. **Worth-learning check (auto-trigger only).** If the user invoked the skill → skip this check and continue to step 2. If the skill auto-routed from conversation signal, score:
   - Contradicts or extends existing context (memory, rules, decisions)?
   - Generalizable beyond the current task?
   - Explicit decision, convention, deprecation, or "next time we should" insight (not an implicit style choice)?

   If at least 2 of 3 are `yes` → continue. Otherwise → print the skip line and exit cleanly.

2. **Gather context.** List `aidd_docs/` (`ls -1tr aidd_docs/`). Pin the files that may need updates.

3. **Auto-analyze.** Answer 5 questions about the recent work:
   - What worked well? (effective patterns, successful approaches)
   - What did not work or required multiple attempts? (corrections, pivots)
   - What decisions were made and why? (technical choices, rationale)
   - What patterns should be reused? (reusable solutions, conventions)
   - What should be avoided next time? (anti-patterns, pitfalls)

4. **Categorize.** For each candidate item, map to its destination using:

   | Category               | Destination                     | Examples                                |
   | ---------------------- | ------------------------------- | --------------------------------------- |
   | **Decisions**          | `aidd_docs/internal/decisions/` | Tech decisions                          |
   | **Memory** (mandatory) | `aidd_docs/memory/`             | Project context, stack updates          |
   | **Rules**              | project rules location          | Coding conventions, patterns to enforce |
   | **Skills**             | project skills location         | Reusable prompts, workflows             |
   | **Templates**          | plugin assets directories       | Skill-specific templates                |

5. **Confirm with user.** Show the numbered plan and ask: `Here's the plan. Which items do you confirm?` Wait for explicit approval before passing to action 02.

## Test

- For a non-learning signal: action prints the skip line and writes nothing.
- For a learning-worthy signal: action emits a numbered plan where every approved item has a non-empty `category` and a concrete `destination` path, and the user has explicitly confirmed before action 02 starts.
