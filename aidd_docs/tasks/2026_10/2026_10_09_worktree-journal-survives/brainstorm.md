# A worktree session outlives the worktree's removal

Refines [#932](https://github.com/ai-driven-dev/framework/issues/932).

Whoever asks what a task cost must get the answer even when the work was done by an agent in a linked worktree, and even when that worktree has already been removed. Today the journal is written inside the worktree's tree, the report reads only the current checkout's journal, and `git worktree remove` deletes a journal that is merely ignored without `--force` (measured with git 2.55.0.windows.5). The session then never reaches the sink, and the task reads `no-journal` or does not exist at all. #631 asks for the link to the task and forbids losing a session silently. This is that defect.

The conclusion written in the hook ("one journal per worktree, at the worktree's root") is amended, along with its claim that `worktree_id` alone serves cross-worktree joining. Its reasons still hold: nothing writes into another branch's tree, and a bare clone has no main working tree. The clone's journal therefore lives in one place, under the clone's common git directory, outside every working tree and outside any worktree's own git directory. `git worktree remove` does not delete it. It is not a checkout file, so it is never committed and dirties no branch. Every reader (report, local read, diagnosis including its unrecognised-records evidence, forget) uses that place, and `AIDD_RUNS_DIR` still replaces it entirely.

## What Is Clear

- A report run from any checkout of the clone counts the sessions of all its worktrees, past ones included, in the totals and in the task or flow. Journals from two clones of the same remote are not gathered together; the totals and the project axis already pool them through the machine's sink.
- Writing happens during the session. A report run only after the removal comes too late.
- `worktree_id` and `worktree_repo_id` stay on the `session_start` line, absent on a plain checkout. The report gains no worktree axis: two worktrees that touched the same task add up their cost. Only the cumulative figure matters: a worktree is a technical artefact an agent runner names, and the task, backlog, flow and agent axes already answer what a piece of work cost. #932 is amended accordingly; `worktree_id` serves only to explain an attribution from the journal.
- One copy is authoritative. No second journal in the worktree's `aidd_docs/runs/`: the two would diverge.
- Journals already written in a worktree that still exists are read alongside the new place, otherwise today's sessions stay invisible. New lines no longer go there.
- A worktree removed before this change, with no earlier read, stays lost. Transcripts are not enough: without a journal, nothing names the session.
- The working checkout's switch still decides whether to write. The person's refusal always wins. The new directory gets the same owner-only permissions `aidd_docs/runs/` gets today; the `.gitignore` entry has no purpose there.
- The sink stays per machine. Task attribution does not move into it: it is still derived from the journal at report time.
- Catch-up into the sink stays gated by the switch of the checkout running the report: measurement off stores nothing, by design (`report-cost-use-case.ts`). Checkouts of one clone share the committed switch in practice.

## Still Open

- The backlog axis resolves a task folder in the current checkout's tree, so a session whose task folder exists only on another worktree's branch reads `none`. Tracked as a defect on #975, outside this change.

## Next Move

Nothing left to decide here: the backlog-axis defect lives on #975. The worktree axis is settled: the report keeps the cumulative figures only, and #932 is amended to say so.
