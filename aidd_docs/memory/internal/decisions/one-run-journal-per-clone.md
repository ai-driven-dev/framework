# One run journal per clone, under its common git directory

- Date: 2026-10-09
- Status: Accepted — closes the open choice in #932, amends the per-worktree default kept after #693
- Decided by: proposed by Vincent Menard, for a maintainer to confirm or overturn

## Context

The hook wrote each session's journal at the root of the checkout it ran in, `<worktree>/aidd_docs/runs/`. The CLI read only the journal of the checkout it ran in, and the sink is filled only through that journal. `aidd telemetry on` git-ignores `aidd_docs/runs/`, and `git worktree remove` deletes a worktree whose only extra content is ignored without needing `--force`. A session an agent ran in its own worktree was therefore missing from every report outside that worktree, and lost for good once the worktree was removed. Agent runners give each agent its own worktree, so this was the common case.

The per-worktree default had two sound reasons: nothing should write into another branch's working tree, and a bare clone has no main working tree to write into.

## Decision

1. The run journal of a clone lives in one directory, `<git common dir>/aidd/runs/`, shared by every worktree of that clone. It is outside every working tree, so it is never committed, dirties no branch, and survives `git worktree remove`. A bare clone has a common dir too.
2. `AIDD_RUNS_DIR` still replaces that location entirely.
3. Journals already written to a live checkout's `aidd_docs/runs/` are still read, never written. The copy under the common git directory wins when one session has both.
4. `worktree_id` stays on the `session_start` line. The report gains no worktree axis: two worktrees that worked on one task add up. Only the cumulative figure matters: a worktree is a technical artefact an agent runner names, and the task, backlog, flow and agent axes already answer what a piece of work cost. The 2026-08-31 decision requires an argument for a new axis; there is none.

## Alternatives

- **Keep one journal per worktree and gather them at report time.** Solves the report, not the removal: the journal still goes with the worktree.
- **Write into the main working tree.** Impossible for a bare clone, and dirties a checkout on another branch.
- **Copy each worktree's journal into the main one.** Two copies of one session diverge, and the copy only happens if someone reports before the removal.

## Consequences

- A worktree removed before this change, never read before, stays lost.
- The hook ships in the plugin and the reader in the CLI, released apart. A newer CLI reads both locations; an older CLI with a newer plugin sees no new session and cannot forget it. The plugin README therefore asks for the CLI to be updated first.
- The two clones of one remote keep two journals; the sink and the project axis already pool them.
- The backlog axis still resolves task folders in the checkout running the report, and catch-up still follows that checkout's switch. Both are outside this decision.
- Hook and CLI spell the location separately (`repo.cjs`, `cli/src/kernel/paths.ts`); a parity test holds them together.
