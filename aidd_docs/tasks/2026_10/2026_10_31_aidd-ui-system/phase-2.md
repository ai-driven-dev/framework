---
status: pending
---

# Instruction: Impact and version guard

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/hooks/
│   ├── aidd-ui.cjs                      ✏️ `impact` command
│   └── lib/
│       ├── graph.cjs                    ✏️ usages of a token or an element, transitively
│       ├── committed.cjs                ✅ a record's committed text, through git
│       └── history.cjs                  ✏️ H8 edited without a new version
└── scripts/__tests__/
    ├── aidd-ui-impact.test.js           ✅
    └── aidd-ui-records.test.js          ✏️ H8 in a temp git repository
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | write the fixture project; for H8, `git init` and commit it in a temp folder | VALID | system |
| Happy path   | run `aidd-ui.cjs impact color.brand.primary` | JSON lists the tokens aliasing it, the components declaring them, the compositions and screens using those, the journeys through those screens, their renders and code files, sorted | cli |
| Happy path   | edit a validated button's usage text, version unchanged | H8 names the button: edited since its committed version 1 | cli |
| Edge case    | raise the version with a history row | H8 silent | cli |
| Edge case    | change only status, `implemented-version`, `code` or History | H8 silent | cli |
| Edge case    | the committed record is proposed, the folder is no git repository, or the record is new | H8 silent | cli |
| Edge case    | `impact` on an unknown id or token | names it on stderr, exit 2 | cli |
| Teardown     | remove the temp folder | baseline restored | system |

## Tasks to do

### `1)` Usages graph

> The change flow reads what a change reaches from the engine.

1. In `graph.cjs`, from a token: the tokens whose alias or raw CSS cites it, transitively, then the records whose `tokens` list one of them.
2. From an element id: the records citing it through `uses`, `replaced-by`, review screens or journey Steps, transitively.
3. Each reached record gives its file, its render when it has one, and its code file when linked.

### `2)` The `impact` command

> One call, one stable JSON.

1. `aidd-ui.cjs impact <ref>… [--root <dir>]` prints `{"tokens", "elements", "screens", "journeys", "renders", "code"}`, each sorted.
2. An unknown ref is named on stderr, exit 2.

### `3)` H8, edited without a new version

> A validated element cannot change silently.

1. `committed.cjs` reads `HEAD:<file>` through git, null when git, the repository or the file is missing.
2. H8: the committed record is validated or deprecated, its text differs once front matter `status`, `implemented-version`, `code` and the History section are set aside, or its render differs, and `version` did not rise.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | a token reached only through an alias and a raw CSS `var()` still reaches its component, screen and journey |
| 2 | output is identical across two runs; an unknown ref exits 2 |
| 3 | each silent case above has its own test; dropping the status or the History exclusion turns its test red |
