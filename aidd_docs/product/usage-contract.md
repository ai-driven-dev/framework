# Usage contract

What `aidd telemetry` records, stores and reports for Claude Code, release 1. The code is the authority; this page is the contract a reader, a hook or a later destination can rely on. A change to a format below changes this page in the same commit.

- The CLI owns reading, storing, attributing and reporting. It is `cli/src/contexts/telemetry/`, mapped in [`cli/aidd_docs/memory/telemetry.md`](../../cli/aidd_docs/memory/telemetry.md).
- The `aidd-telemetry` plugin owns three hooks that ask for a task, answer it, and record session facts. They are plain Node, in `plugins/aidd-telemetry/hooks/`.
- Only Claude Code is measured in release 1. The record admits other tools; no reader for them exists.

## The usage record

One record per billed model call: facts only. No cost, person, task or ticket is in it; those are derived once, at report time, for every tool. The type is `UsageRecord` in `cli/src/contexts/telemetry/domain/usage-record.ts`.

| Field | Type | Meaning |
| --- | --- | --- |
| `tool` | `claude-code` \| `codex` | the tool whose files were read |
| `tool_version` | string \| null | version that wrote the source line |
| `key` | string | stable across re-reads; unique within `tool` |
| `session_id` | string | the tool's own session id |
| `agent` | `main` \| `subagent` \| `advisor` | who made the call |
| `at` | ISO-8601 UTC | when the call was recorded |
| `model` | string \| null | the model that billed it |
| `input` | integer \| null | input tokens, excluding any cache read or write |
| `output` | integer \| null | output tokens, reasoning included |
| `cache_read` | integer \| null | input tokens served from cache |
| `cache_write` | integer \| null | input tokens written to cache, all lifetimes |
| `cache_write_1h` | integer \| null | of which one-hour lifetime; `null` when not said |
| `reasoning` | integer \| null | of which reasoning; `null` when not said |
| `cwd` | string \| null | working directory of the line, local only |
| `git_branch` | string \| null | branch of the line, local only; it names the branch whose declaration to look up and is never parsed |

The ledger stores a `StoredUsage`: the record plus `repository_id`, resolved at ingest.

### Null is not zero

An unknown value is `null`, never `0`. A report leaves a call out of a counter's sum when the counter is `null`, and counts it in that counter's `unknown_records`. A shape the reader does not recognise is counted in `coverage.unrecognised_shapes`. A usage line that lacks a counter is still a record, with that counter `null`; a line that is no usage line at all (not JSON, no `message.usage`, no `message.id`, `sessionId` or `timestamp`) is never turned into a record. The report words both together: "not recognised: a call missing a counter is kept with that counter unknown; a line that is no usage line is not counted".

### Key and fold rule

- Claude Code key: `message.id:requestId`; a line with no `requestId` uses `message.id:sessionId:timestamp`; each advisor iteration adds `#advisor<n>`.
- A call is written several times (streamed snapshots, resumed sessions, sub-agents). One record is kept per `(tool, key)`: the largest total of the four counters, a counter that is `null` counting as `0` for this comparison only. A tie goes to the earliest `at`, then the lowest `session_id`, then the serialised record. No input order changes the winner.
- Reading Claude Code lines (`domain/formats/claude-transcript-usage.ts`):
  - a `<synthetic>` model is dropped;
  - `cache_write` is summed over the `message` iterations, because the top-level split reflects only the first;
  - each `advisor_message` iteration is its own record with `agent: advisor` and its own model;
  - `isSidechain` or an `agentId` makes the call a `subagent`.

### Repository

A call's repository is its working directory resolved at ingest: the directory's git root, named by the hash of the `origin` address (`host/owner/repo`), else the root commit. The address itself is never kept. A call is stored only by the rule in [Consent, version 2](#consent-version-2). A call read and left out is counted in `coverage.not_stored` under one reason: `outside-repo`, `never-seen-alive`, `no-consent` (a clone with no consent at the time of the call: it had not opted in yet, or had turned measurement off), `consent-closed` (its live key names an interval that was closed: the person is told to run `aidd telemetry on`), `unreadable-consent` (a git config or a `.git` git cannot read, a directory or git dir the file system will not let ingest look at, a clone it gives no identity, or a damaged consent log), `no-cwd` or `undated`.

## The report envelope

`aidd telemetry report --json` prints one object, `version: 1`. A field may be added to version 1; a field is never renamed, retyped or removed without a new `version`. The type is `ReportEnvelope` in `cli/src/contexts/telemetry/application/report/report-envelope.ts`.

| Field | Meaning |
| --- | --- |
| `version` | `1` |
| `period` | `{from, to}`, UTC days, `null` for open |
| `axis` | `total`, `person`, `session`, `model`, `day`, `repository`, `task` or `ticket` |
| `rows` | one per value of the axis |
| `totals` | the whole period |
| `unknown_records` | calls with at least one counter unknown |
| `coverage` | `files_read`, `records`, `unrecognised_shapes`, `not_stored`, `consent_log_damaged`, `oldest_transcript_at`, `skipped_ledger_lines` |

A row and `totals` hold `records`, four counters (`input`, `output`, `cache_read`, `cache_write`) and `total`. A counter is `{tokens, unknown_records}`. A row also holds:

| Field | Meaning |
| --- | --- |
| `kind` | `value`, `unattributed` or `absent` |
| `key` | the axis value for a `value` row, else `null` |
| `reason` | `no-binding` or `declared-none` for an `unattributed` row, else `null` |

- Every axis is a partition of the same calls, so every axis adds up to the same `totals`, counter by counter.
- Under `AIDD_TELEMETRY=0` nothing is read and the object is `{"version": 1, "refused": "AIDD_TELEMETRY=0"}`.
- A report reads new transcripts first. `coverage.files_read` and `unrecognised_shapes` describe that run; `records` describes the period.
- The envelope holds no path, working directory or branch name. Its `session` axis keys are full session ids and its `repository` axis keys are hashes.

## Stores and their owners

The telemetry directory is `AIDD_TELEMETRY_DIR`, else `AIDD_USER_CONFIG_DIR/telemetry`, else `XDG_CONFIG_HOME/aidd/telemetry`, else `~/.config/aidd/telemetry`. An empty variable is unset. The CLI (`runtime/wiring/telemetry.ts`) and the hooks (`hooks/lib/telemetry-dir.cjs`) apply the same rule, pinned by one fixture, `scripts/__tests__/fixtures/telemetry-bindings/`. The directory is created private.

| Store | Writer | Readers | Holds |
| --- | --- | --- | --- |
| `ledger/<YYYY-MM>.jsonl` | `ingest`, `report` | `report`, `forget` | one `StoredUsage` per line, by the month of its `at`; only a month that changed is rewritten, whole, by rename; an ingest that finds no new bytes writes nothing |
| `ledger/offsets.json` | `ingest`, `report` | `ingest`, `report` | per transcript: bytes consumed, size, file identity; a file that shrank or changed identity is read whole |
| `ledger/roots.json` | `ingest`, `on` | `ingest`, `forget` | format `{version: 2, directories}`: per working directory and per clone it was seen alive in, `repository_id`, `root`, `clone` (its identity), `seen_at`. A file of another format holds nothing: a directory seen alive is remembered again, one that is gone is counted `never-seen-alive`. `on` records its own root here so `forget` finds the repository it declared tasks in |
| `ledger/consents.jsonl` | `on`, `off`, `ingest`, and the hooks (close lines only) | `on`, `off`, `ingest`, `forget`, the hooks | append-only: `{token, clone, open}` when `on` opens an interval and `{token, close}` when `off`, an ingest or a hook ends it; when each clone consented. It is the ledger's, so a clone's deletion does not delete it and `forget` removes it with the ledger. The hooks read it with their own strict parser, pinned by the shared fixture |
| `ledger/.lock` | the CLI | the CLI | `{pid, created_at}`; a lock of a dead process, or older than ten minutes, is cleared |
| `bindings/.lock` | the CLI | the CLI | the bindings lock, same format as the ledger's: a declaration appends its session line, and any snapshot reads the latest snapshots and appends, under it. `task` never takes the ledger lock, which an ingest holds while it reads transcripts |
| `bindings/sessions.jsonl` | `task` | hooks, `report`, `task` | `{session_id, task, ticket, none, declared_at, by}`; `by` is `command` or `hook-intercept` |
| `bindings/branches.jsonl` | `task`, `ingest`, `report` | `report`, `forget` | a branch declaration at one moment, with the branch's creation time from its reflog |
| `bindings/carries.jsonl` | the `SessionStart` hook | hooks, `report` | `{session_id, from, at}` |
| `bindings/processes.jsonl` | the `SessionStart` hook | the `SessionStart` hook | `{pid, session_id, source, at}`; no CLI reader |
| `identity.json` | `identity` | `report` | `{"person_id": "<id>"}`, written owner-only |
| `branch.<name>.aiddTask`, `aiddTicket`, `aiddDeclaredAt` in the repository's git config, `--local` | `task` | hooks, `task`, `report` via snapshots | a branch declaration; it follows a branch rename and goes with the branch |
| `aidd.telemetry` in the repository's git config, `--local` | `on`, `off`, `forget` | hooks, the CLI | the clone's consent: `2:<token>` (the token of the open interval `on` made), or `off`. Consent needs the interval as well: the key alone grants nothing, to the hooks or to storing |

- A line that is not exactly the format of its store is skipped, never guessed at. Every JSON Lines store is append-only except the ledger.
- `forget` removes `ledger/`, `bindings/`, `identity.json`, the declaration keys in each recorded clone's git config, the consent key, and what an earlier measurement left. It never removes the telemetry directory itself.

## Attribution

A task and a ticket are known only from a declaration: `aidd telemetry task <name> [--ticket <ref>]`, or `--none`. No branch name, folder name, commit message or prompt is ever parsed for one. A ticket is free text, kept as typed.

A declaration binds the running session (when `CLAUDE_CODE_SESSION_ID` is set) and, on a working branch, the branch. The default branch (the target of `origin/HEAD`, else `main` or `master`) and a detached `HEAD` are never bound.

A call belongs to, in order:

1. its session's declaration in force at that moment;
2. else its session's carry;
3. else its branch's declaration. A branch binds every call made on it after it was created, so declaring late moves earlier work onto the task;
4. else no task: `no-binding`. A declaration of no task is `declared-none`.

Sub-agent and advisor calls name their parent's session and follow it.

## The ask rule

`UserPromptSubmit` (`hooks/prompt-gate.cjs`) blocks a prompt, before the model is called, when all of these hold:

- the payload is Claude's own: its `session_id` equals `CLAUDE_CODE_SESSION_ID` and its `transcript_path` runs under a `projects` directory;
- this clone is measured (its key `aidd.telemetry` names an interval open in the consent log for this clone, see Consent), and `AIDD_TELEMETRY` is not `0`;
- a person is present: `CLAUDE_CODE_SESSION_ATTENDED` is `1` and `CLAUDE_CODE_ENTRYPOINT` is set and does not start with `sdk`. Both are undocumented, so either missing or different means nobody is asked, never that work is blocked;
- the branch is a working branch, with no declaration for the session or the branch;
- `aidd` is on `PATH` and knows `telemetry task`. Without it nothing is asked.

Anything else passes. The hook never fails a prompt: a crash exits 0.

Answering is never blocked and never reaches the model:

- `! aidd telemetry task ...` in the terminal fires no `UserPromptSubmit`;
- `aidd telemetry task ...` typed as a prompt is run by the hook through the CLI with `--by hook-intercept`, and its result is the block reason. The grammar accepts a name, `--ticket <ref>` and `--none` and nothing else; a prompt outside it runs nothing. A one-line prompt that starts like a declaration, holds only words and quoted strings, and has no `?`, no `!`, no comma and no final full stop (`aidd telemetry task fix cart`) was meant as one: it is blocked with the grammar and the quoting hint, and kept visible. Any other prompt that merely starts with those words is an ordinary prompt.

The block asks once per working branch, since the declaration it gets is remembered. Switching to an unbound branch asks again.

## The carry rule

`/clear` and `/branch` start a new session in the same Claude process, and the payload names no predecessor. The `SessionStart` hook (`hooks/session-start.cjs`) records `(pid, session_id, source, at)` for every start, with the process id from `CLAUDE_PID`, else the hook's parent.

- On `source` `clear` or `fork` (`/branch`), the predecessor is the process's previous session, if its fact is newer than the machine's boot (process ids are reused across boots).
- Residual limit: the guard is the boot time only, not the process start time. A pid reused within one boot by a new Claude process whose own `startup` was never recorded (for example, it started before `on`) can take the dead process's last session as its predecessor, so a later `/clear` would carry that session's task. The carry is announced and replaced by the first declaration.
- If that session is bound, a carry `{session_id, from, at}` is appended and the person is told: `Task <task> kept after /clear. Different work: aidd telemetry task <name> [--ticket <ref>]`.
- `startup`, `resume` and `compact` carry nothing.
- A carry is provisional. The first declaration made in the carried session replaces it for the whole session, retroactively, calls made before it included. A session that was not carried is bound from its declaration onward and no earlier.

## Consent, version 2

### The rule

> A call is stored only when all three hold:
> 1. its directory was seen alive belonging to clone X;
> 2. X had an open consent interval at the call's time;
> 3. `AIDD_TELEMETRY=0` is not set.

There is nothing else: no backfill and no special case for a first `on`, no interval that starts before its `on`, no consent flag remembered anywhere else, and no live-key condition on a live clone, because the intervals are the truth. **Measurement starts at `on`.** What a clone's sessions did before it is not counted, and `on` reads nothing back.

Every clause is decided from facts observed, never from what a path or a remote looks like:

- **Clone identity.** A clone is its git common dir: the `dev`, `ino` and `birthtimeMs` of `fs.stat` on its real path, plus that real path. Ingest records it in `ledger/roots.json` the first time it sees a directory alive. The identity is unavailable, and the call is not stored (counted `unreadable-consent`), when `ino` is `0` or missing, or when the file system will not let ingest `stat` the clone: any error other than not-found is the same as having no identity, so one unreadable clone never aborts an ingest or a report. When the common dir now at a remembered path has another identity, the remembered clone is gone, and the clone now there never answers for calls the remembered one made. A directory that several clones have lived in keeps one entry per clone; a call goes to the latest clone born at or before it (its birth time, else the time ingest first saw it), else to the first, and to the only one when there is only one. Going to a clone does not store it: the owner's interval must cover the call, and none opens before the clone's `on`.
- **Consent intervals.** `ledger/consents.jsonl`, append-only, outliving the clone. A line is one of two shapes, pinned by the shared fixture (`consentLog` cases):
  - open: `{"token": "<uuid>", "clone": {"path", "dev", "ino", "birthtimeMs"}, "open": "<ISO-8601 UTC>"}`, where `clone` is the identity above;
  - close: `{"token": "<uuid>", "close": "<ISO-8601 UTC>"}`.

  A token is opened once (a second opening is ignored). A token closed more than once ends at the earliest close, whatever order the lines were written in: ingest and the hooks both append, so the order of the lines says nothing about the order of events. A close of a token never opened changes nothing. An interval is half-open: `on` at T covers a call at T, `off` at T does not. A blank line is not damage.
- **`on`** mints a fresh random token, writes `git config --local aidd.telemetry 2:<token>`, then appends the open line, under the ledger's lock. The key goes first: a key with no interval measures nothing, while an interval its key does not name would be closed by the first hook to see it. An `on` that finds the key naming an interval open for this very clone changes nothing. Any other `on` first closes this clone's stale open intervals, at its own time.
- **`off`** appends a close for the clone's open token at its time, then sets the key to `off`, under the same lock. `forget --yes` removes the file with the ledger and unsets the key in every clone recorded.
- **Ingest** closes an open interval, at the time it observes one of these: the identity at its path changed (another directory is there); the live key is not `2:<that token>`. A clone with nothing at its path is not closed: it may only be out of reach (an unmounted volume, a folder moved away and back), it makes no new calls while it is, and it is measured again, without a new `on`, the moment the same directory is back. Closing is left to the identity changing, so a clone made again at the path is another clone and the old interval ends when ingest first sees it. It looks at every open interval before it judges a call, whether or not a call of that clone was read. A clone whose git config cannot be read, or that cannot be `stat`ed, keeps its interval open and stores nothing. When a call is refused and the clone's live key names an interval of it that was closed, ingest and `report` count it `consent-closed` and say "run `aidd telemetry on`"; they never say the clone has not opted in.
- **The hooks also close.** The `SessionStart` hooks and the prompt gate append close lines to `consents.jsonl`, in the format above. When a hook passes the Claude-only guard and runs in a clone whose key does not name an open interval recorded for that clone's real path, it appends a close for that interval at its own time. The guard comes first, then this observation, which applies even when nobody is present (headless). This is what ends a manual `git config aidd.telemetry off` (or `--unset`) before the next prompt's calls. `AIDD_TELEMETRY=0` makes a hook do nothing, this included.
- **Fail closed.** A line of `consents.jsonl` that is not exactly one of the two shapes means the log cannot be trusted. Storage is refused for every clone, `on` and `off` refuse and change nothing (not the key, not the log), and every `ingest` and every `report` run says so while it lasts, under `coverage.consent_log_damaged` for `--json`. Recovery is `aidd telemetry forget --yes`, then `aidd telemetry on` in each clone to measure. That is safe: `forget` removes the log and the transcript offsets, there is no backfill, and an interval opens at `on`, so nothing made before it is stored. Removing the damaged line by hand is not a recovery and the tool no longer suggests it: the lost line may have been a close, and the interval it ended would reopen over a window the person turned off. Calls read while the file is damaged are not kept for later: the offsets move on.

Residual limits, none of them observable by the CLI:

- **A manual change of the key between two observations.** A manual `git config aidd.telemetry off`, with no hook prompt and no ingest before the next `on`, leaves the interval open until something observes the key. Every call dated before that observation is covered, those made after the key was turned off included. Any Claude Code session start or prompt in the clone, or any ingest, is such an observation.
- **A clock.** A call is judged by its transcript timestamp, the machine's clock. A call stamped inside an interval is covered whenever it was written, and a future-dated call is covered by any interval still open. A call stamped outside its interval is refused or stored by its stamp alone.
- **A worktree made and removed between two ingests.** A linked worktree of an opted-in clone that is created, used and removed before any ingest or session start saw it alive was never seen alive, and its calls are counted `never-seen-alive`. In practice the session start that opens the session inside it sees it alive.
- **Where there is no birth time,** a clone that reuses a deleted clone's path and inode is taken for it (`dev` and `ino` alone are its identity), and of two clones that lived at one directory the later is told from the earlier only from the moment ingest first saw it there.
- **A moved or renamed clone** is a new clone: its path is part of its identity. Its old interval stays open while nothing is at the old path and ends when another directory is seen there; nothing is stored for the clone at its new path, nor asked of it, until `aidd telemetry on` is run there. A clone that is out of reach for a while and returns at the same path with the same identity (an unmounted volume, a folder moved away and back) is the same clone and stays measured.
- **A consent log edited by hand** is outside the contract. Following the old advice to remove a damaged line can reopen a window that `off` closed; the tool now says `forget --yes`.
- **A call read while its clone's git config, `.git` or git dir cannot be read** is counted `unreadable-consent` and is not kept for later: the offsets move on, so a repaired clone does not get it back.
- **A process id reused by Claude Code,** per the carry rule above.
- **`AIDD_TELEMETRY=0`** stops the hooks too: a key turned off by hand while it is set is observed at the next hook or ingest run without it.

### The clone's consent

Consent is per clone, in the repository's own git config, and is never committed. `aidd telemetry on` runs `git config --local aidd.telemetry 2:<token>`. Only `2:` and a token is consent, and the key is only half of it: the token must name an interval open in the consent log for this very clone.

- `--local` writes the common config, so every linked worktree of the clone shares it, and no commit carries it: a teammate who pulls the repository is not measured, asked or blocked until they run `aidd telemetry on` in their own clone;
- nothing in `.aidd/config.json` is consent, including a committed `telemetry: {enabled: true, version: 2}`; the previous version's bare `enabled: true` is not either. The CLI and the hooks do not read that file for consent;
- a git config git cannot read is `unreadable`, grants nothing, and is never rewritten;
- `AIDD_TELEMETRY=0` refuses measurement whatever a clone granted;
- `off` sets `aidd.telemetry` to `off` and closes the interval; `on` and `off` write the key and the interval under the ledger's lock, so an ingest never sees one without the other;
- `on` refuses a clone whose git dir the file system gives no identity, and changes nothing;
- **the hooks treat a clone as consenting only when all three hold:** its key is `2:<token>`; `consents.jsonl` holds an open interval with that token; and that interval's recorded clone is this one, by its common-dir real path and by its identity: the hook `stat`s that directory and compares `dev`, `ino` and `birthtimeMs`, normalised exactly as the CLI does (the inode as text, a Linux birth time equal to the change time as `0`, no inode as no identity). The normalisation and the comparison are pinned by the shared fixture (`cloneIdentity` and `hookConsent` cases). A key set by hand (`2`, or a made-up token), a `cp -R` copy at another path, a copy moved onto the deleted original's path, a clone made again at the same path, or a moved clone is not consenting for the hooks either: nothing is asked and nothing is blocked there, the hook closes nothing that is not this clone's, and the person runs `aidd telemetry on`. `aidd telemetry task` applies the same test;
- a clone that never opted in has nothing stored, nothing asked and nothing blocked.

`on` also removes the previous version's `telemetry` block from `.aidd/config.json` if it holds one, every other byte of the file as it was, and deletes the file only when that block was all it held (the change may need committing, and `on` says so). It removes what an earlier measurement left in the repository, records its own clone so `forget` can find it, and warns when Claude Code's transcript retention is short. It does not read back what was said before it, and does not reset the transcript offsets. It ends with the next step: declare a task, which the plugin's hooks ask for in Claude Code.

`forget --yes` unsets `aidd.telemetry`, with the branch task keys, in every clone recorded in `roots.json` or `consents.jsonl`, as long as the clone still exists. It names only the clones that are gone and had consented: one that never did left nothing to remove.

## What never leaves the machine

Release 1 sends nothing anywhere: no code in the telemetry context or the hooks opens a network connection. Everything above lives on the machine, and `aidd telemetry forget --yes` removes it.

- Local only, never to be sent: `cwd` and `git_branch` in the ledger, the roots in `roots.json`, the process facts, the transcripts themselves.
- The text report names no path, branch, working directory or whole session id (session and repository appear as short keys). The envelope names no path, branch or working directory either, but its `session` keys are whole session ids, as above. `task` and `forget` print what they act on, so they do name a branch (`Branch feat/x is bound.`) and paths (`forget` lists every entry and repository it would remove), and the lock error names the lock file.
- The person's identity exists only if they chose one with `aidd telemetry identity <id>`; it labels the `person` axis and nothing else.
- A currency amount is never computed here: the destination owns the price table.
