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
   cwd gone (16 % of lines on backfill) → judged by the clone it was last seen in (told from a
   clone made at the same path by its identity), else counted as `never-seen-alive`, not
   `outside-repo`.
   A clone that did not opt in (its `aidd.telemetry` git config, and a consent interval written by
   `on`) or `AIDD_TELEMETRY=0` → not ingested at all.
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
   - Session override: `aidd telemetry task` run inside a session (`CLAUDE_CODE_SESSION_ID`,
     Codex `CODEX_THREAD_ID`) binds that session; it beats the branch. Measured: a `!`
     command sees `CLAUDE_CODE_SESSION_ID` and `ATTENDED=1`, and does not fire
     `UserPromptSubmit`, so answering the block is never itself blocked. `/clear` starts a
     new session id and the payload carries no previous id, but the process survives
     (measured: `CLAUDE_PID` and hook parent identical across startup + 2 `/clear`).
     `SessionStart` records `(CLAUDE_PID, process start time) → session`; on
     `source: clear` it copies the predecessor's binding to the new id, tagged
     `carried: clear from <id>`. `resume` uses the resumed session's own binding; `fork`
     carries the predecessor's binding like `clear`; `startup` carries nothing. The machine's
     boot time guards PID reuse (a pid reused within one boot is a residual limit, see
     `usage-contract.md`).
   - A carried binding is provisional: it is announced (`systemMessage`, measured visible:
     "SessionStart:clear says: …") with the command to change it, and the first explicit
     `aidd telemetry task` in that session replaces it for the whole session, retroactively.
     An explicit binding in a session that already had one applies from its timestamp.
     The prompt is never read to guess the need.
   - When to ask (pure code, `UserPromptSubmit`, every prompt, cheap): telemetry on for the
     project AND `CLAUDE_CODE_SESSION_ATTENDED=1` AND branch is neither the default
     (`origin/HEAD`) nor detached AND neither branch nor session is bound → block, reason
     shown to the human: `! aidd telemetry task <task> [--ticket X]` or `--none`. Re-checked
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
   session declaration, else the session's carry, else the branch declaration in force at the
   call, else
   `unattributed` with reason `no-binding | declared-none`.
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
- Phase 6 probes (Claude Code 2.1.295, interactive, sandbox config dir, dummy key; ids and paths redacted):
  - A hook `{"decision":"block","reason":"R"}` shows `UserPromptSubmit operation blocked by hook:R` followed by `Original prompt: <text>`; with `hookSpecificOutput.suppressOriginalPrompt: true` the reason shows and the `Original prompt:` line is gone. The blocked text is put back in the input box, so the person can retype it.
  - `/branch` fires `SessionStart` with `source: "fork"`. Payload keys: `session_id`, `transcript_path`, `cwd`, `prompt_id`, `hook_event_name`, `source`, `model`, `session_title` (`<first prompt> (Branch)`). No parent session id anywhere in payload or env. `CLAUDE_PID` and the hook's parent pid are unchanged from the original session, so the predecessor is the pid's previous session, as for `/clear`.
  - On `/clear` and on `/branch`, `CLAUDE_CODE_SESSION_ID` in the hook equals the payload `session_id` (the Claude-only guard holds on both), and the next `UserPromptSubmit` carries the new id in both.
  - `UserPromptSubmit` does not fire for `!` commands (measured earlier, re-checked).
  - End to end with the shipped hooks: an unbound `feat/x` prompt is blocked with both forms named; `aidd telemetry task demo --ticket P-1` typed as a prompt reaches the CLI as `telemetry task demo --ticket P-1 --by hook-intercept` and the next prompt passes; `/clear` appends a carry from the same pid and shows `SessionStart:clear says: Task demo kept after /clear. Different work: aidd telemetry task <name> [--ticket <ref>]`; the async catch-up runs `telemetry ingest --quiet` once per session start.
  - Pending (needs the maintainer, phase 6 task 5): `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_CODE_ENTRYPOINT` and whether a block reason displays, in the VS Code extension and the desktop app. Until observed those surfaces never block.
- Codex `UserPromptSubmit` can block (docs: `decision: block` or exit 2). Its unattended
  signal is not yet known: Codex stays out of release 1.
- `CLAUDE_CODE_SESSION_ATTENDED` is undocumented: a contract test pins its two values, and
  the block also requires `CLAUDE_CODE_ENTRYPOINT=cli` (two independent signals must agree).

## Oracles

Fixture + mutation per rule (contract/check.py: 6/6 killed); 16 counting pitfalls; ccusage
diff; OTel `api_request` by `request_id`; Analytics API daily totals.
