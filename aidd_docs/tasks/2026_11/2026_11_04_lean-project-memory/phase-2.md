---
status: done
---

# Instruction: One rule table, shared by the engine and the model

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/hooks/lib/memory-rules.cjs ✏️
├── plugins/aidd-context/skills/02-project-memory/references/
│   ├── memory-rules.md ✏️
│   └── review-protocol.md ✏️
└── scripts/__tests__/
    ├── memory-rules-table.test.js ✅
    └── memory-lint.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | read the rule ids of `plugins/aidd-context/hooks/lib/memory-rules.cjs` | M1 to M7 | system |
| Happy path | the test reads the table in `memory-rules.md` | the same ids, severities and limits as the engine | system |
| Edge case | a rule added to the engine and not to the table | the test fails naming it | system |
| Edge case | a count of things the noun list misses, such as `9 plugins` or `eleven packages` | M2 reports it; `Node 22` and `step 2` do not | system |

## Tasks to do

### `1)` The table

> One place says what a memory file must be.

1. Write the failing test first: the ids, severities and word limits of the table equal the engine's.
2. Rewrite `memory-rules.md` as one table: the machine rules M1 to M7 with their limits, then the rules only a reader can judge (non-derivable, points to the code, one fact in one home, no version, current state only).
3. Make `review-protocol.md` judge content only and point to the table for the rest.

### `2)` Stale counts

> A count of any things is a volatile fact, not only of a fixed list.

1. List the counts the four real banks hold (framework root, `cli/`, gouvernail, kairos-app) that M2 misses today, as fixtures.
2. Widen M2 to a number, in digits or words, before a plural noun, keeping the look-alikes silent; tests first.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | the test fails when the table and the engine differ, and passes now; no rule is stated outside the table |
| 2 | every count fixture from the real banks is an M2 error, every look-alike silent |
