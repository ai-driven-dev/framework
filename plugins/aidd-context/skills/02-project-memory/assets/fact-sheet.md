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

## Answers

- Read the answer in the person's own words; ids are optional.
- `ok` or "all good" is `yes` on every line, "all but X" is `yes` on every line but X, in one turn.
- An answer unclear for a line leaves a `remove` or `replace` on it unapplied; silence is yes on an addition.
- `tools: claude, codex` or "wire it into claude" picks the tools; `C2: no` appends `: no` to that `C` entry.
- An unanswered `Q` drops its slot.
- Autonomous: only when the caller's instruction answers for the user.
