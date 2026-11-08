# Report message

The chat reply that ends a request. Reply with only this: no lead-in, no closing line.

- Plain words, one line per item, a blank line between sections.
- Leave out a section with nothing in it.
- Never name the engine's commands, their exit codes or the warning count; say what changed for the person.
- At most one line per changed file, one per left-out item, one heads-up.
- Send it as plain chat text, not in a code fence; the fence below is for this file only.
- Stop after the message: no offer to reverse a declined line, no "say ... if you want" closing.
- On a check request nothing is written: reply `Needs attention` only, one line per finding with its file, and say the bank is current when nothing drifted.

```text
Memory ready

Written
  aidd_docs/memory: project-brief.md, vcs.md, testing.md
  CLAUDE.md: wired

Changed
  D3  vcs.md: pre-commit now runs `scripts/pre-commit.sh`

Left out
  D4  testing.md: you declined
  Q1  commit standard: unanswered. Tell me the answer any time and I add it to vcs.md.

Heads-up
  Every session loads 295 words from 9 files.
```
