# Telemetry target, release 1 (v3, after shadow areas and four challenges)

> Research record. Where it differs from [`../spec.md`](../spec.md), the spec wins: release 1
> sends nothing (point 8 is out), the previous telemetry is removed rather than reused, and the
> command's final name is set by the plan.

Goal: Claude Code only. Deterministic tokens per person, session, model, day, repository;
tokens per task and ticket. Push to Gouvernail. Ship fast and clean.

## Release 1

1. **Reader.** `<CLAUDE_CONFIG_DIR or ~/.claude>/projects/**`, recursive (subagents,
   workflows, `.jsonl.superseded-*` set-asides). Byte offset per file; a file that shrank or
   changed identity is re-read whole; an unterminated last line waits. Key
   `message.id:requestId` (requestless: `message.id:sessionId:timestamp`), global fold: max
   total, tie → earliest `at`, then lowest `session_id`. Advisor iterations are records;
   cache writes summed over message iterations; `<synthetic>` dropped. Root resolved per
   line (subagents run in their own worktrees).
2. **Root and repository at ingest.** realpath + case-fold → `git rev-parse` → root;
   repository id = hash of `host/owner/repo` from `origin`, else the root commit SHA.
   cwd gone (16 % of lines on backfill) → `root-unresolved`, not `outside-repo`.
   Project switch off or `AIDD_TELEMETRY=0` → not ingested at all.
3. **Ledger** in its own subdirectory of the telemetry dir (the v1 sink prunes `*.jsonl`
   by count there), relocated by `AIDD_TELEMETRY_DIR`; monthly partitions; newline guard;
   lock with pid and age, stale lock cleared. `forget` covers it.
4. **Ingest**: every `aidd telemetry` command; `SessionStart` async catch-up (also fires on
   resume, clear, compact: idempotent). No ingest in `Stop` (hooks are skipped under
   `--bare`, safe mode, managed-only hooks, and blocked in cloud sessions). Setup offers
   `cleanupPeriodDays: 3650`, reports a managed override or a paused sweep. Reports state
   coverage.
5. **Binding: asked once per working branch, remembered, all inside the plugin.**
   - Store: `git config branch.<name>.aiddTask` (+ ticket, created-at from reflog). Follows
     renames, dies with the branch. The branch name is never parsed.
   - Session override: `aidd task start` run inside a session (`CLAUDE_CODE_SESSION_ID`,
     Codex `CODEX_THREAD_ID`) binds that session; it beats the branch. Measured: a `!`
     command sees `CLAUDE_CODE_SESSION_ID` and `ATTENDED=1`, and does not fire
     `UserPromptSubmit`, so answering the block is never itself blocked. `/clear` starts a
     new session id and the payload carries no previous id, but the process survives
     (measured: `CLAUDE_PID` and hook parent identical across startup + 2 `/clear`).
     `SessionStart` records `(CLAUDE_PID, process start time) → session`; on
     `source: clear` it copies the predecessor's binding to the new id, tagged
     `carried: clear from <id>`. `resume` uses the resumed session's own binding; `fork`
     and `startup` carry nothing. Start time guards PID reuse.
   - A carried binding is provisional: it is announced (`systemMessage`, measured visible:
     "SessionStart:clear says: …") with the command to change it, and the first explicit
     `aidd task start` in that session replaces it for the whole session, retroactively.
     An explicit binding in a session that already had one applies from its timestamp.
     The prompt is never read to guess the need.
   - When to ask (pure code, `UserPromptSubmit`, every prompt, cheap): telemetry on for the
     project AND `CLAUDE_CODE_SESSION_ATTENDED=1` AND branch is neither the default
     (`origin/HEAD`) nor detached AND neither branch nor session is bound → block, reason
     shown to the human: `! aidd task start <task> [--ticket X]` or `--none`. Re-checked
     each prompt, so switching to an unbound branch asks again. Blocking before the model
     call means no token is spent unattributed.
   - Unattended (`ATTENDED=0` with `ENTRYPOINT=sdk-cli` under `-p`, measured;
     `CLAUDE_CODE_CHILD_SESSION=1` in both modes, so not a signal) or flag absent: never
     block (a blocked `-p` exits 0 having done nothing, measured). Bound branch → bound
     automatically; unbound → `no-binding`, re-attributed once the branch is bound.
   - Subagent and workflow lines carry the parent `sessionId` → inherit its binding.
   - Skills that know the ticket call the command first, so the block never shows.
   - No launcher, orchestrator, env var or branch convention is required or read.
6. **Attribution** (one pure local function, decided: the command is the only source):
   session binding →
   `unattributed` with reason `outside-repo | root-unresolved | no-binding | declared-none`.
7. **Report axes**: person (v1 opt-in `person_id`), session, model, day, repository, task,
   ticket. Four counters always separate.
8. **Push**: opted-in records, attributed locally; no cwd, root, or branch names. Upsert by
   `(person, tool, key)`; a re-bind re-pushes affected keys.

## Deferred (they caused most of the silent-misattribution findings)

Root-scoped bindings and their adoption/`ambiguous` rule; cross-machine binding sync;
"session seen" marker; ingest inside `Stop`; cloud sessions (need managed settings).

## Verified (sandbox, Claude Code 2.1.295)

- Hooks fire in interactive and `-p`; `ATTENDED` 1 vs 0; `!` carries the session id;
  `/clear` = new id, no link in the payload.
- Codex `UserPromptSubmit` can block (docs: `decision: block` or exit 2). Its unattended
  signal is not yet known: Codex stays out of release 1.
- `CLAUDE_CODE_SESSION_ATTENDED` is undocumented: a contract test pins its two values, and
  the block also requires `CLAUDE_CODE_ENTRYPOINT=cli` (two independent signals must agree).

## Oracles

Fixture + mutation per rule (contract/check.py: 6/6 killed); 16 counting pitfalls; ccusage
diff; OTel `api_request` by `request_id`; Analytics API daily totals.
