# Coding Assertions

Done means every gate below is green. CLI gates: [`internal/cli/testing.md`](internal/cli/testing.md).

## Before the code

- Write the test first; watch it fail for the reason it names.
- A test green on its first run is redundant; drop it, except a characterization test written before a move.
- Prove each guard: break what it names and watch that test, alone, go red.
- After a scripted edit, read the file back before running anything.
- Write no code for an input never seen in real data; state it as a limit.
- Between two fixes, take the one that deletes.
- No dates or ticket or run IDs in code, comments, tests, CI or docs.
- Report or commit only what output just showed.

## Before commit

| Command | Checks |
| --- | --- |
| `pnpm exec lefthook run pre-commit --all-files` | every job in `lefthook.yml`; the `cli` jobs only when `cli/` changed |
| `pnpm exec commitlint --edit` | the message against `commitlint.config.cjs` |

- The hook regenerates each plugin's `CATALOG.md` and the README counts, and stages them.
- `kanban/` alone fires no local job: run `cd kanban && pnpm test`; CI runs `kanban-checks`.
- `context-reference-form` reads only the files `TARGET_FILES` in `memory.cjs` names: root `CLAUDE.md` and `AGENTS.md`.

## Before push

| Command | Checks |
| --- | --- |
| `pnpm exec lefthook run pre-push` | `cli` knip, copies between tool profiles, the full `cli` suite, when `cli/` changed |

- `scripts/gate-witness.js` skips a gate this exact tree already passed: same index, unstaged edits and untracked files.
- `--no-verify` skips the local gates only: every pull request still runs `ci.yml` and `cli-ci.yml`.
- `git push --delete` still runs the full `cli` suite: the hook cannot tell it from a normal push.

## On failure

- One agent per failing gate, never one agent for all.
