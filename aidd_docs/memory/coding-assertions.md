# Coding Assertions

The checks that must pass for code to count as done. Minimal, run after every change.

## Before the code

Whether a test is written, and when, is the Policy in [`cli/aidd_docs/memory/testing.md`](../../cli/aidd_docs/memory/testing.md):

- A bug fix and a new domain rule start with the test, watched red for the reason its name gives.
- A refactor, move, rename or wiring change adds no test; a characterization test is deleted when the refactor ends.
- A new check is proven once in its PR by a planted break, written in the PR and not kept as a test.

Two more habits, learned by paying for them:

- **After any scripted edit, read the file back before running anything.** A replacement
  whose anchor drifted applies to nothing and reports nothing, which is how a field can be
  declared in a type, believed by a display and produced by no code. An inconsistent state is
  worse than a missing feature: nobody designed it, so nobody can reason about it.
- **A test fails for a case; only real data says the case occurs.** Write no code for an
  input never observed in real data: state it as a limit. A review finding about such an
  input is closed by that written limit, not by code. Between two fixes, take the one that
  deletes.

Never state in a commit message or a report anything not just observed in output.

> CLI-specific completion criteria: [`cli/aidd_docs/memory/coding-assertions.md`](../../cli/aidd_docs/memory/coding-assertions.md).

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `pnpm exec lefthook run pre-commit --all-files` | JSON and YAML validity, `scripts/` tests, skill frontmatter and argument hints, cross-plugin orthogonality and router coherence (`scripts/check-architecture-rules.js`), context imports and reference form, markdown links, the paths the prose names, a sentence written in two documents (`scripts/check-doc-duplication.js`) and a path from a contributor's machine (`scripts/check-no-local-paths.js`); `cli` lint, architecture, typecheck and type honesty when `cli/` changed. `cli` knip and the full `cli` suite are pre-push, not pre-commit — see below |
| 2 | `pnpm exec commitlint --edit` | the message against `commitlint.config.cjs` |

Same hook regenerates each plugin's `CATALOG.md`, and the README counts, and stages them.

Every `cli` job is globbed on `cli/**`. A change under `kanban/` alone fires no local job; run `cd kanban && pnpm test` by hand. CI does cover it — `cli-ci.yml`'s `kanban-checks`, see `deployment.md`.

- `context-reference-form` reads only the two files `memory.cjs`'s `TARGET_FILES` names: root `CLAUDE.md` and root `AGENTS.md`. It never walks the tree, so `cli/CLAUDE.md`'s memory block is outside it.
- `context-imports` walks the whole tree (`scripts/check-context-imports.js`'s `collectContextFiles`).
- `context-reference-form` also globs `plugins/aidd-context/hooks/memory.cjs`, whose table is its source of truth.

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `pnpm exec lefthook run pre-push` | `cli knip`, the copies between tool profiles, then the full `cli` suite, when `cli/` changed |

Each runs through `scripts/gate-witness.js`, which skips a gate this exact tree already passed: same index, same unstaged edits, same untracked files. A tree that changed while the gate ran is never stamped.

`--no-verify` buys little, not nothing:

- A push to a feature branch fires no workflow.
- Any pull request fires `ci.yml` and `cli-ci.yml`, whatever its base.
- Only a pull request targeting `main` or `next` replays the pre-commit, and `validate.yml` drops `cli-biome`, `cli-architecture` and `cli-typecheck` from it.

Deleting a remote branch is the one push to send with it. `git push --delete` carries no commit, and the gates still run. Measured: lefthook forwards git's pre-push stdin to no command, the hook environment is byte-identical to a normal push, and a `glob` filter matches anyway. Nothing inside the hook can tell the two apart, so the full `cli` suite runs over a push that has nothing to validate.

## Behavior

Done means every gate green. On failure, one agent per failing assertion — typecheck, tests, rules — not one agent for all.
