# Facts: <scope>

- Capabilities: C1 <name>, C2 <name>
- Base: <short id> <commit subject>, or `audit` and its reason (refresh only)

Under a block, one fact per line: `- <id> | <file> > <section> | <fact> | <source> | <answer>`
No `|` in a fact. The source is one existing plain path, no backticks, line number or glob; a removal cites the memory file; a `Q` may cite none. Leave the answer empty; the skill fills it from the person's reply.

## Read

From the file that defines the fact. R1, R2.

## Inferred

Deduced from the code. D1, D2. To change or remove an existing line, start with `remove` or `replace` and quote the old line exactly between double quotes.

## Unknown

What the code cannot say. Q1, Q2. At most eight.

## To rule

A convention no rule covers. T1, T2. File and section name the rule topic. Not written to memory.

## Presentation

Show it once in chat as below; a removal shows `(removed: <reason and source>)` for the `+` line.

```text
Sheet: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_memory-<scope>/facts.md

To replace or remove (2)
- D3 vcs.md > Setup
  - "pre-commit runs `make lint-all`"
  + "pre-commit runs `scripts/pre-commit.sh`"
- D4 testing.md > Tools
  (removed: no such tool in package.json)

Additions and confirmations: 12 lines, in the sheet

Questions (1)
- Q1 Which commit standard does the project follow?

Answer ok to accept all, or by id: no D3, Q1: <answer>.
```
