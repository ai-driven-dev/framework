---
name: 05-review-conversation
description: Reviews a finished conversation tree for wasted time, tokens or correctness and proposes remedies grounded in evidence. Use when the user wants to diagnose a run or choose an instruction to fix. Not for delivery review or automatic edits.
argument-hint: conversation | export
---
# Review conversation

```mermaid
flowchart LR
  start([conversation ID or export]) --> read["actions/01-read-conversation.md"]
  read -->|"incomplete, source available"| read
  read -->|"required evidence unavailable"| unavailable((incomplete))
  read -->|"complete"| recommend["actions/02-recommend.md"]
  recommend --> render["actions/03-target-edits.md"]
  render -->|"check failed, fixable"| render
  render -->|"checks passed"| done((report verified))
  render -->|"checks unavailable"| unverified((report unverified))
  render -->|"unresolved failure"| blocked((blocked))
```

## Transversal rules

- **Scope:** access only the selected conversation tree and its relevant sources.
- **Evidence:** use recorded facts and cite the session and message sequence for every finding.
- **Uncertainty:** mark unavailable measurements and unproven causes explicitly.
- **Writes:** keep project files read-only and write only inside one unique temporary run directory.
