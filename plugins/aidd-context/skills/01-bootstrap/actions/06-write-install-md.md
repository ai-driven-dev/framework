# 06 - Write INSTALL.md

Produce `INSTALL.md` (technologies, why chosen, how to install) from the filled checklist, stack decisions, module diagram. Plus project-root `README.md` from its template.

## Inputs

- Filled checklist (stack items from action 04, architecture pattern from action 05).
- Mermaid diagram (from action 05).
- Audit verdicts (from action 03) - inform `Why` column, not a section.

## Outputs

New file `INSTALL.md` filled from `@../assets/INSTALL.md`.

Plus two project-root docs:

- `README.md` filled from `@../assets/README.md`

## Depends on

- `05-decide-architecture`

## Process

1. Read `@../assets/INSTALL.md`. Skeleton.
2. Fill each placeholder from upstream artifacts:
   - **Vision**: project name + one-liner from block 1
   - **Decisions table**: each row from block 4 paired with one-line `Why` derived from block 2-3 constraints
   - **Stack summary**: concrete versions / SaaS plans where known
   - **Building blocks table**: one row per selected block - the block, its chosen provider, its env flag (only blocks the app needs; Data always present)
   - **Architecture**: paste Mermaid diagram from action 05 + 2-3 sentences explaining module boundaries
   - **Install, configure, run, test**: prerequisites the developer handles manually (accounts, runtimes, secrets), then concrete install / configure / run / test commands for chosen stack.
3. Write filled content to `INSTALL.md` in project root. If file exists, ask before overwriting.
4. Write project-root `README.md`: fill `@../assets/README.md`. Source every `{{...}}`: frameworks / database / test framework from block 4; `{{SRC_DIR}}` from architecture pattern's source-root convention (e.g. `src/`). Drop conditional lines (no database) per choices. Leave no raw `{{...}}`.
5. Print relative paths of written files + short summary.

## Test

- [ ] `INSTALL.md` exists and filled.
