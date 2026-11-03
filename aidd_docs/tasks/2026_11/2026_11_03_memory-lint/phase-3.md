---
status: done
---

# Instruction: Lint engine

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/hooks/
│   ├── lib/memory-rules.js ✅
│   └── memory-lint.js ✅
└── scripts/__tests__/
    └── memory-lint.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | write a bank of memory files in a temp project | files on disk | system |
| Happy path   | run `node memory-lint.js <root>` on a bank of tables, bullets and headings | prints nothing that is an error, exits 0 | cli |
| Edge case    | one file per rule M1 to M7 breaking it | one line naming the file, the line, the rule id and its severity; exit 1 when an error is among them | cli |
| Edge case    | a line that only looks like a breach: a code fence, a mermaid block, `TODO'd`, a version, a `README.md` | no problem | cli |
| Edge case    | a rule that throws | one problem naming that rule, the other rules still report | system |
| Edge case    | no `aidd_docs/memory/` in the root | prints nothing, exits 0 | cli |
| Teardown     | remove the temp project | baseline restored | system |

## Tasks to do

### `1)` Rules

> Each rule is a pure function of a file's text and what the bank and project hold, in `hooks/lib/memory-rules.js`; it reads nothing itself.

1. M1 error: a line outside a table, list, heading, code fence, blockquote, comment or diagram over 25 words.
2. M2 error: a count of things (commits, branches, files, tests, lines, issues, pull requests, users, records, runs, sessions), an ISO date, `currently`, `as of`, `right now`, `at the moment`.
3. M3 error: `{{`, a bare `TODO`, `TODO:` or `TBD`.
4. M4 error: a backticked path with an extension whose top-level entry exists in the project while the path does not, copied from `scripts/check-referenced-paths.js`; existence comes in as a function the engine gives.
5. M5 warning: a bullet or a table cell over 35 words.
6. M6 warning: a file over 400 words.
7. M7 warning: a sentence of 12 words or more found in another memory file, copied from `scripts/check-doc-duplication.js`.

### `2)` Engine

> One function the hook and a person call alike; the only file that reads the disk.

1. Export `lintFile(root, file)` and `lintBank(root)`, `README.md` excluded, each problem `{ file, line, rule, severity, message }`, errors before warnings.
2. A rule that throws becomes one problem naming it.
3. As a script: `node memory-lint.js [root] [file...]` prints one `✗` or `⚠` line per problem, exits 1 when an error remains, 0 otherwise.

### `3)` Calibration

> The rules fire on real banks the way the issue measured, and on nothing that only looks like a breach.

1. Run the engine on this repository's two banks, `aidd_docs/memory/` and `cli/aidd_docs/memory/`, and read each error back; a false positive becomes a fixture and a fix.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | each of M1 to M7 reports its fixture with its id and severity, and no look-alike fixture |
| 2 | `lintBank` skips `README.md`; a throwing rule is one named problem; the script exits 1 only with an error |
| 3 | every error the engine reports on this repository's banks is a true breach |
