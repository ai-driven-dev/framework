# Headless runs

Both hosts served this branch, synced with `scripts/dev-sync.sh aidd-context` (v2.3.2). Before the sync, both caches held 2.2.0 and its five old actions, so an unsynced run would have tested the released skill and passed for the wrong reason.

Every claim below was read off disk, never off the model's report.

## Claude, existing repo with code and no memory

Picked `claude`. Detected `core`, `api` (`express` + `src/routes/`), `database` (`pg` + `src/db.js`).

- 9 memory files, all flat in `aidd_docs/memory/`. No subfolder.
- `CLAUDE.md` had no `## Memory Management`. The section was appended, the block filled with all 9 files.
- The hand-written line in `CLAUDE.md` survived.
- `AGENTS.md` was never created. Only the picked tool was touched.

The review fanned out to one `aidd-dev:checker` per file and earned its keep: it found that `pg` is declared but imported nowhere, and that `src/db.js` is required by no caller. The first draft's architecture diagram had drawn `Routes → Db → Postgres`, three edges that do not exist in the code. The reviewers, none of whom wrote the file they read, caught what the writer could not see.

## Claude, a repo whose memory was already nested

The fixture carried `memory/core/project-brief.md` and `memory/internal/architecture.md`, the client bug.

Scan stopped at the confirmation gate, as designed, so nothing was written. What it said before stopping is the proof the destinations table fired:

> `core/` is a template-selection folder, not a path. This is a misplaced generated file. Its flat home `aidd_docs/memory/project-brief.md` does not exist, so nothing is loading it today.

It planned to write the flat file, carry the nested file's content into it, leave the orphan in place, and report it. That matches the decision: prevent and surface, never auto-remediate.

## Codex, hand-written `AGENTS.md` carrying no block

Picked `codex`. Same fixture shape as the Claude run.

- 9 memory files, all flat.
- `AGENTS.md` had no block at all. The action inserted the section and the block, then the script filled it.
- The hand-written line survived.
- `CLAUDE.md` was never created.
- The script was called as `update_memory.js codex`, so the picked-tool argument reached it.

Codex spawned nine independent reviewers of its own.

## What stays unproven

- **The no-subagent fallback never ran.** Both hosts have subagents, so `review-protocol.md`'s degrade path is untested. It is defensive code, not verified behavior. Do not report it as working.
- **The interactive contract is untested.** Every run pre-answered the tool pick and the capability confirmation in the prompt. The blocking ask itself was exercised only once, in the nested-drift run, where scan correctly refused to proceed.
