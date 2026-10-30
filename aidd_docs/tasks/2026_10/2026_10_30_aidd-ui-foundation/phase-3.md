---
status: pending
---

# Instruction: Code link

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/hooks/lib/
│   └── code.cjs ✅
└── scripts/__tests__/
    └── aidd-ui-code.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `writeProject(tmp)` | the valid project | system |
| Happy path   | `code.check(load(tmp))` | `[]` | system |
| Edge case    | C1: `code` path absent; export name absent from the file; `code` without `#` | one problem each | system |
| Edge case    | C2: `package:left-pad#Pad` not in `libraries` | one problem | system |
| Edge case    | C3: `src/ui/Orphan.tsx` linked by no record and under no `ignore` | one problem naming the file | system |
| Edge case    | C3: a `proposed` record whose `code` points at an existing file | no problem: the link is optional before `coded`, valid when present | system |
| Edge case    | C4: `color: #ff0000` in `src/ui/Button.tsx`; the same in `src/ui/tokens.css` | one problem with its line; none, the file is ignored | system |
| Edge case    | C4: `padding: 16px` in a `.css` file under `src/ui/`; the same in a `.tsx` file | one problem; none, units in script files are a stated limit | system |
| Edge case    | C5: two records with the same `code` | one problem naming both | system |
| Edge case    | C6: `margin-left` in a `.css` file under `src/ui/` while `rtl` is declared | one problem | system |
| Teardown     | remove `tmp` | no file left | system |

## Tasks to do

### `1)` Link rules

> C1 and C2 hold.

1. `code.cjs`: split `code` on its last `#`; a `package:` link needs its name in `system.md` `libraries`; any other needs the file under the project root and the export as a whole word in it.

### `2)` Coverage and literals

> C3 to C6 hold.

1. Walk each `code-roots` prefix; flag each file no `code` names and no `ignore` prefix covers.
2. In files with extension `.css`, `.scss`, `.js`, `.jsx`, `.ts`, `.tsx`, `.vue`, `.svelte`, `.html`, outside `ignore`, flag colour literals with their line, with the render pattern.
3. In `.css` and `.scss` files only, flag unit literals and, when `rtl` is declared, physical properties, with the render patterns.
4. Flag two records sharing one `code`.

### `3)` Tests

> Each rule has its mutation.

1. `aidd-ui-code.test.js`: the Happy path, then one test per Edge case row.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | an absent file, an absent export, a malformed link and an undeclared package each have their own message |
| 2 | an orphan file, a colour literal, a unit literal, a shared link and a physical property each have their own message; an ignored file and a unit in a script file have none |
| 3 | reverting any one rule turns exactly its test red |
