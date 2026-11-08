# Facts: <scope>

Path: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_memory-<scope>/facts.md`, `<scope>` being setup or refresh.

- Capabilities: C1 <name>, C2 <name>
- Base: <short id> <commit subject>, or `audit` and its reason (refresh only)

Fill each slot of the selected files from the repository, skipping a slot the bank answers. A slot takes every fact the sources state for it, one line each: each gate, decision, gotcha, rule and release step. The brief's `Users`, `Main journey` and `Business rules` come only from what the repository states, else a `Q` line, never invented; a setup or an audit collects them, a refresh from a base never adds them.

Under a block, one fact per line: `- <id> | <file> > <section> | <fact> | <source> | <answer>`
No `|` in a fact. The source is one existing plain path, no backticks, line number or glob; a removal cites the memory file; a `Q` may cite none. Leave the answer empty.

## Read

From the file that defines the fact. R1, R2.

## Inferred

Deduced from the code. D1, D2. To change or remove an existing line, start with `remove` or `replace` and quote the old line exactly between double quotes. To relocate a misplaced file, write `move <path> to <path>`.

## Unknown

What the code cannot say. Q1, Q2. At most eight.

## To rule

A convention no rule covers. T1, T2. File and section name the rule topic. Not written to memory.

## Presentation

Show it once in chat as below. Under each file, list its added lines when the sheet holds 15 or fewer in all, else only the count. Show `Tools` on a setup only.

```text
Sheet: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_memory-<scope>/facts.md

Files to write (3)
- C1 api.md
- C2 auth.md
- C3 vcs.md

To replace or remove (2), applied only on yes
- D3 vcs.md > Setup
  - "pre-commit runs `make lint-all`"
  + "pre-commit runs `scripts/pre-commit.sh`"
- D4 testing.md > Tools
  (removed: no such tool in package.json)

Additions and confirmations: 12 lines
- api.md: 7
- vcs.md: 5

Questions (1)
- Q1 Which commit standard does the project follow?

Tools (detected ticked)
[x] claude  [ ] codex  [ ] cursor  [ ] opencode  [ ] copilot

Answer ok to accept all, or by id: yes D3, no D4, C2: no, Q1: <answer>, tools: claude, codex.
```

## Answers

- `ok` is `yes` on every `D` line, `no D3` is `no` on that line, `C2: no` appends `: no` to that `C` entry, `tools: claude, codex` picks the tools.
- Silence is yes, except on a `remove` or `replace` line, which needs `yes`.
- An unanswered `Q` drops its slot.
- Autonomous: only when the caller's instruction answers for the user.
