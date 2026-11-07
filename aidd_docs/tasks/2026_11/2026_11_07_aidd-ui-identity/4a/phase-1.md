---
status: pending
---

# Instruction: pilot script, its checks, the baseline on today's skills

## Architecture projection

```txt
.
├── scripts/
│   ├── aidd-ui-pilot.cjs ✅
│   └── __tests__/aidd-ui/
│       └── pilot.test.js ✅
└── aidd_docs/tasks/2026_11/2026_11_07_aidd-ui-identity/
    └── run-4a.md ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | a temp git repository holding a tracked, an ignored and an untracked file; the fixture project | ready | system |
| Happy path | copy the repository, snapshot the copy, write under `aidd_docs/ui/` and in `.git/`, compare | the copy holds the tracked file alone, is a committed git repository; no change reported; the source's snapshot unchanged | cli |
| Edge case | add, modify, delete a file outside `aidd_docs/ui/` | each path reported once | cli |
| Edge case | `stepsWithoutWireframe` on a journey whose steps name wireframes, then one naming a screen or nothing known | `[]`, then that step listed |
| Edge case | `verdict` on the fixture, then without `tokens.json`, then with two rules failing | `VALID`, `T1`, the two rule ids sorted | cli |
| Happy path | run the pilot on the current skills, blank, Gouvernail and Kairos | one report line per pilot; exit 0 or 1, never 2 | cli |
| Teardown | remove the temp dirs | gone | system |

## Tasks to do

### `1)` Pure checks, test first

> What the pilot asserts holds without AI.

1. `pilot.test.js`, red first: `copyProject(source, dest)` (tracked files only, `git init`, one commit, source snapshot unchanged); `changedOutsideUi(before, after)` over `snapshot(dir)` (relative path to sha256, `.git/` skipped), ignoring `aidd_docs/ui/`; `verdict(root)` from `node <engine> validate <root>`: `VALID`, else the sorted unique rule ids of its lines; `stepsWithoutWireframe(root)`: each journey step, read through the engine's `project.cjs` `load`, whose `Screen` cell names no wireframe record; `reportLine(pilot, result)`: `<pilot> validate <verdict> wireframes <all|missing n> code <untouched|changed n>`.
2. `aidd-ui-pilot.cjs` exports them; `copyProject` pipes `git -C <source> archive HEAD` into `tar -x`, never runs any other command in the source.

### `2)` The run

> One command chains the skills with Haiku on throwaway copies.

1. Usage `node scripts/aidd-ui-pilot.cjs --gouvernail <checkout> --kairos <checkout>`; header doc block as `check-claude-tokens-end-to-end.cjs`; exit 0 when every pilot is `VALID`, every step has its wireframe and the code is untouched, 1 otherwise, 2 when a step cannot run.
2. Pilots: `blank`, an empty dir; the two checkouts copied per task 1. Copies under `os.tmpdir()`, kept, their paths printed.
3. Requests, split in parts written once: journeys, brand, foundations, components, each followed by the non-interactive suffix of the earlier pilot prompts (take the answer given or the most reasonable one, never install, never run the project's scripts). Blank from the earlier wording (Breath, Lea, web and mobile, light theme, English); real pilots from their code.
4. Chain today: `/aidd-ui:02-journeys <journeys>`, then `/aidd-ui:01-system <brand> <foundations> <components>`.
5. Each step: `claude -p --model haiku --no-session-persistence --plugin-dir <repo>/plugins/aidd-ui --setting-sources local --allowedTools "Read,Write,Edit,Glob,Grep,Skill,Bash(node:*),Bash(ls:*),Bash(git ls-files:*)" --output-format text`, the request on stdin, cwd the copy, output to a file beside it; the flags and tools of the earlier pilot runs, observed loading the plugin and reaching the engine.
6. After the chain: `verdict`, `stepsWithoutWireframe`, `changedOutsideUi`, `reportLine`.

### `3)` Baseline

> The result today, before any restructuration.

1. Run it on the current tree.
2. Check `~/.claude/projects/` holds no session for any copy; one found: delete it, then the script deletes it after each step.
3. Write the three report lines in `run-4a.md` under `## Baseline`, no path, no date.

### `4)` Mutations

> Each check turns its own test red.

1. One at a time, run wrapped, see its own test fail, restore: `changedOutsideUi` returning `[]`; the `aidd_docs/ui/` exclusion dropped; `copyProject` copying the working tree; `copyProject` writing into the source; `verdict` keeping duplicate or unsorted ids; `stepsWithoutWireframe` returning `[]`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | the wrapped suite passes `pilot.test.js`, which failed before the code existed |
| 2 | the command prints one line per pilot and exits 0, 1 or 2 as stated |
| 3 | `run-4a.md` holds the three baseline lines; no session left for a copy |
| 4 | every check has a mutation its own test kills |
