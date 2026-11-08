# Sheet message

The chat reply that shows the sheet once, before anything is written. Reply with only this: no lead-in, no closing line.

- Plain words, short lines, a blank line between sections.
- Leave out a section with nothing in it.
- Say what each file will hold, from the sheet's lines, never only a count.
- Use `Will write` for a new file and `Will change` for an edit to existing lines.
- Show `Tools to wire` on a setup only.
- End with the one question below, in the person's language; name in its example only a D line or a question that exists.
- Send it as plain chat text, not in a code fence; the fence below is for this file only.
- Stop after the message: no offer to reverse a declined line, no "say ... if you want" closing.

```text
Memory plan

Will write
  project-brief.md   what the product is and who it serves
  vcs.md             branches, commits and pull requests (5 lines)
  testing.md         how tests run and which tools (3 lines)

Will change
  D3  vcs.md
      "pre-commit runs `make lint-all`"
      → "pre-commit runs `scripts/pre-commit.sh`"
  D4  testing.md
      "tests run with jest"
      → removed, jest is no longer a dependency

Questions
  Q1  Which commit standard does the project follow?

Tools to wire
  [x] claude  [ ] codex  [ ] cursor  [ ] opencode  [ ] copilot

Does this look right? Say ok, or what to change, for example "not D3" or "Q1: …".

Sheet: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_memory-<scope>/facts.md
```
