---
status: done
---

# Instruction: the engine documents itself, the pilot proves who writes what

## Architecture projection

```txt
.
├── plugins/aidd-ui/
│   ├── hooks/
│   │   ├── aidd-ui.cjs ✏️
│   │   └── lib/
│   │       ├── help.cjs ✅
│   │       └── records.cjs ✏️
│   └── skills/
│       ├── 01-journeys/
│       │   ├── actions/01-prepare.md ✏️
│       │   └── references/engine.md ✏️
│       ├── 02-brand/
│       │   ├── actions/01-prepare.md ✏️
│       │   ├── assets/brand-template.md ✏️
│       │   └── references/engine.md ✏️
│       ├── 03-foundations/
│       │   ├── SKILL.md ✏️
│       │   ├── actions/01-prepare.md ✏️
│       │   ├── actions/02-write.md ✏️
│       │   └── references/
│       │       ├── engine.md ✏️
│       │       └── extraction.md ✏️
│       └── 04-components/
│           ├── SKILL.md ✏️
│           ├── actions/01-prepare.md ✏️
│           └── references/engine.md ✏️
├── scripts/
│   ├── aidd-ui-pilot.cjs ✏️
│   └── __tests__/
│       ├── fixtures/aidd-ui/project.js ✏️
│       └── aidd-ui/
│           ├── help.test.js ✅
│           ├── pilot.test.js ✏️
│           ├── records.test.js ✏️
│           ├── skill.test.js ✏️
│           └── validate.test.js ✏️
└── aidd_docs/tasks/
    ├── 2026_10/2026_10_30_aidd-ui-rework/spec.md ✏️
    └── 2026_11/2026_11_07_aidd-ui-identity/run-4a.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | record `cat plugins/aidd-ui/skills/*/*.md plugins/aidd-ui/skills/*/*/*.md \| wc -w` | 5922 today, written in `run-4a.md` | cli |
| Happy path | `node <engine> help`, then `help <command>` for each command | the list; per command its usage, effects, JSON output, exit codes | cli |
| Edge case | `help valdate` | exit 2, the command list on stderr | cli |
| Edge case | a brand without `## Platforms` | `validate` prints `VALID` | cli |
| Edge case | pilot `main` with a fake `runStep`: a step writing outside its set, one writing nothing, a chain leaving no journey | exit 1, each named on its line; no model spawned | cli |
| Happy path | pilot on blank, Gouvernail, then Kairos twice | every line `errors none`, `wireframes all`, `code untouched`, `steps ok` | cli |
| Teardown | delete the pilot copies, check no chat is left | gone | system |

## Tasks to do

### `1)` The engine documents itself

> The engine's text lives once, in the engine.

1. `help.test.js`, red first:
   - every `COMMANDS` key, `help` included, has a help entry;
   - `help <command>` prints its usage line, effects, JSON output and exit codes, exit 0;
   - `help validate` prints the count line, the error and the warning line shapes;
   - `help hook` adds the grouped line shape: only the hook groups;
   - `help <unknown>` exits 2 with the command list;
   - every help sentence has twelve words at most, usage lines exempt.
2. `hooks/lib/help.cjs`: one entry per command, text taken from today's four `engine.md`.
   - The `*_USAGE` constants and the flags they use move there, strings unchanged.
   - `aidd-ui.cjs` imports both for `parse`; `publish.test.js` pins hold.
   - `help hook` carries the hook bullets of today's Output block.
   - `help bump` says what `--task` names: a path under `aidd_docs/tasks/`, never written.
   - Nothing in `common-rules.cjs`: it is the library shared across plugins.
3. `aidd-ui.cjs`: `help` joins `COMMANDS`; `COMMANDS` exported for the test.
   - The unknown-command usage points to `help`; E9 in `validate.test.js` follows.
4. `skill.test.js`, red first, then each `engine.md` shrinks to:
   - the install table, and `<engine>` as that path run with `node`;
   - `## Commands`: the names this skill runs, and `node <engine> help <command>`;
   - `## Owed by a later step`, unchanged, so the owed-problems tests hold.
5. The test: an `engine.md` holds only those headings; each name listed is a help key.
6. The 04-components refusals of `brand` and `system` leave with the copies.
7. Mutations, one at a time: drop one help entry; `help <unknown>` exits 0; one sentence of 13 words; the Output block pasted back into one `engine.md`; `valdate` listed in one `engine.md`.

### `2)` Prepare says each step once

> One line per step the four prepares share.

1. Find `<engine>` and stop when missing: one step, its path rule in `engine.md`.
2. Read `aidd_docs/ui/` and the UI code, then name the case: one step.
3. The task folder: "Take the task folder the user named, else ask."
4. No skill names another; nothing links outside its folder: the existing tests stay green.

### `3)` The pilot proves the split

> Each step changes its own files, and something.

1. `pilot.test.js`, red first, through `main` with fake `copyProject` and `runStep`:
   - a step writing a file outside its set: exit 1, the step and the path named;
   - a step changing no owned file, engine files aside: exit 1, the step named;
   - a chain leaving no journey step: exit 1, `wireframes no journey`;
   - a chain writing only owned and engine files: exit 0, `steps ok`.
2. Owned sets, from each `SKILL.md` "Write only" line, `aidd_docs/ui/` left out:
   - `01-journeys`: `journeys/`, `wireframes/`; `02-brand`: `brand.md`;
   - `03-foundations`: `system.md`, `tokens.json`, `themes/`, `platforms/`, `breakpoints/`;
   - `04-components`: `components/`, `assets/`;
   - every step: `history.md`, `code-debt.json`, `tokens.css`, `tokens.resolver.json`.
3. 03 and 04 "Write only" lines name those paths; a test pins each set to its line.
   - Observed: the kept copies' `aidd_docs/ui/` hold only these paths.
   - Limit: `bump --change` also writes elements and reviews; the pilot only creates.
4. `snapshot` after each step; `stepsWithoutWireframe` returns `null` when nothing loads or no step exists.
5. `reportLine` adds `steps ok` or `steps broken <n>`; the errors are printed below it.
6. Mutations: the owned check returns `[]`; an engine file left out of the allowed set; `null` back to `[]`; the line pin dropped from one set.

### `4)` Platforms have one author

> `platforms:` in `system.md` alone.

1. `records.test.js`, red first: a brand without `## Platforms` validates.
2. `records.cjs`: `Platforms` leaves `BRAND_HEADINGS`.
3. Brand template, fixture `BRAND`, `FILLS.brand` lose the section; global spec line 45 loses "plateformes".
4. Searched: only R14 reads `BRAND_HEADINGS`; `bump.cjs` and `history.cjs` test the kind alone.
5. Mutation: `Platforms` back in `BRAND_HEADINGS`.

### `5)` System answers come from the code

> `system.md` is filled from what the system needs.

1. `03-foundations/actions/02-write.md` step 2: code answers from step 1's reading, per extraction.
2. `extraction.md`: one row, the apps the code roots serve go in `platforms`.
3. What extraction names no source for is asked; scratch asks each.

### `6)` Pilot docstring

> The header says what the script checks.

1. Exit 1: any error, a missing wireframe, changed code, or a step outside its files.
2. One line: copies stay under `TMPDIR`; remove with `rm -rf "${TMPDIR:-/tmp}"/aidd-ui-pilot-*`.

### `7)` Verification

> Every gate green, the pilot strict.

1. `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`.
2. `node scripts/check-architecture-rules.js $(git ls-files plugins/aidd-ui)`, `node scripts/check-doc-duplication.js`, `node scripts/check-markdown-links.js --ignore cli/tests/fixtures --ignore cli/aidd_docs/tasks`.
3. Word count rerun, before and after written in `run-4a.md`.
4. `node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout>`, then `--only kairos`.
5. Lines in `run-4a.md` under a new heading; mutations added to its table.
6. No chat left for any copy; every `aidd-ui-pilot-*` copy deleted, earlier ones too.

### Out of scope

- Brand versioning: 4b.
- Pilot request wording per skill: 4b.
- A word budget per skill: the final lean pass.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `help` covers every command; each `engine.md` holds install, command names, owed table; each mutation fails its own test |
| 2 | each prepare states engine, reading and task folder once; structure tests pass |
| 3 | a fake step outside its set, or writing nothing, or no journey, exits 1; each mutation fails its own test |
| 4 | a brand without `## Platforms` validates; the mutation fails it |
| 5 | step 2 sources answers from the code per extraction, not README or copy |
| 6 | the header states the absolute exit 1 and the cleanup line |
| 7 | the commands exit 0; words well below 5922; four pilot lines `errors none`, `wireframes all`, `code untouched`, `steps ok` |
