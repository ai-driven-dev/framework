# 01 - Gather

Collect the source the plan will rest on, before any planning. Read only.

## Input

The user's request, which may be empty.

## Output

The source restated in a few bullets: what is asked and the hard constraints it states. The source kind and reference (file path, ticket id, or text) are named.

## Process

1. **Find.** Identify what the request points to: a file path, a ticket URL or id, or raw text. When nothing concrete is given, ask once for a file, a ticket, or a description. Do not start without a source.
2. **Pull.** Read the file, fetch the ticket, or take the text as given. Never invent content the source does not contain.
3. **Restate.** Summarize the source in a few bullets: what is asked, and the hard constraints it states. No solution, no phases, no plan.

## Test

- The output names the source kind and reference and restates it in bullets, states no solution, and when nothing concrete was given the user was asked before anything else.
