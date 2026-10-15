# Usage contract

> For: maintainers, hook authors, a later destination. What `aidd telemetry` records, stores and reports for Claude Code, release 1. How to use it: [plugin README](../../plugins/aidd-telemetry/README.md). Where the code is: [`cli/aidd_docs/memory/telemetry.md`](../../cli/aidd_docs/memory/telemetry.md).

The code is the authority. A change to a format below changes this page in the same commit.

| Part | Owns |
| --- | --- |
| CLI, `cli/src/contexts/telemetry/` | reading, storing, attributing, reporting |
| Plugin hooks, `plugins/aidd-telemetry/hooks/`, plain Node | asking for a task, answering it, recording session facts |

Only Claude Code is measured. The record admits other tools; no reader for them exists.

```mermaid
flowchart LR
  T["Claude Code transcripts"] -->|"ingest"| L[("ledger")]
  C[("consent log + git key")] -->|"gates storing"| L
  H["hooks"] -->|"session facts, carries"| B[("bindings")]
  H -->|"close lines"| C
  K["aidd telemetry task"] -->|"declarations"| B
  L --> R["report"]
  B -->|"attribution"| R
```

## Usage record

One record per billed model call, facts only: no cost, person, task or ticket. Those are derived once, at report time, for every tool. Type: `UsageRecord`, `cli/src/contexts/telemetry/domain/usage-record.ts`.

| Field | Type | Meaning |
| --- | --- | --- |
| `tool` | `claude-code` \| `codex` | tool whose files were read |
| `tool_version` | string \| null | version that wrote the line |
| `key` | string | stable across re-reads, unique within `tool` |
| `session_id` | string | the tool's session id |
| `agent` | `main` \| `subagent` \| `advisor` | who made the call |
| `at` | ISO-8601 UTC | when the call was recorded |
| `model` | string \| null | model that billed it |
| `input` | integer \| null | input tokens, cache read and write excluded |
| `output` | integer \| null | output tokens, reasoning included |
| `cache_read` | integer \| null | input served from cache |
| `cache_write` | integer \| null | input written to cache, all lifetimes |
| `cache_write_1h` | integer \| null | of which one-hour; `null` when not said |
| `reasoning` | integer \| null | of which reasoning; `null` when not said |
| `cwd` | string \| null | working directory, local only |
| `git_branch` | string \| null | branch, local only; names the declaration to look up, never parsed |

The ledger stores `StoredUsage`: the record plus `repository_id`, resolved at ingest.

**Null is not zero.**
- Unknown is `null`, never `0`. A `null` counter is left out of its sum and counted in that counter's `unknown_records`.
- A usage line missing a counter is still a record, that counter `null`.
- A line that is no usage line (not JSON, no `message.usage`, no `message.id`, `sessionId` or `timestamp`) is never a record. An unrecognised shape counts in `coverage.unrecognised_shapes`.
- The report says: "not recognised: a call missing a counter is kept with that counter unknown; a line that is no usage line is not counted".

**Key and fold** (`domain/formats/claude-transcript-usage.ts`).

| Rule | Value |
| --- | --- |
| Key | `message.id:requestId`; without `requestId`, `message.id:sessionId:timestamp`; each advisor iteration adds `#advisor<n>` |
| Fold | a call is written several times (streamed snapshots, resumed sessions, sub-agents); one record per `(tool, key)`: largest sum of the four counters (`null` as `0` for this comparison only) |
| Tie | earliest `at`, then lowest `session_id`, then serialised record. No input order changes the winner |
| Dropped | model `<synthetic>` |
| `cache_write` | summed over `message` iterations (the top-level split reflects only the first) |
| Advisor | each `advisor_message` iteration is a record, `agent: advisor`, own model |
| Sub-agent | `isSidechain` or an `agentId` |

**Repository.** The call's working directory resolved at ingest: its git root, named by the hash of the `origin` address (`host/owner/repo`), else the root commit. The address is never kept.

**Not stored.** Storing follows [Consent](#consent). A call read and left out counts in `coverage.not_stored` under one reason:

| Reason | When |
| --- | --- |
| `outside-repo` | no git root, or a repository with neither origin nor root commit |
| `never-seen-alive` | directory gone, never seen alive |
| `no-consent` | clone had no consent at that time: not opted in yet, or turned off |
| `consent-closed` | its live key names a closed interval; says "run `aidd telemetry on`", never says the clone has not opted in |
| `unreadable-consent` | git config or `.git` unreadable, directory or git dir the file system will not let ingest look at, clone with no identity, damaged consent log |
| `no-cwd` | no working directory |
| `undated` | timestamp not a readable date, with no zone (`Z` or `±hh:mm`), or outside four-digit years |

## Report envelope

`aidd telemetry report --json` prints one object, `version: 1`. A field may be added to version 1; never renamed, retyped or removed without a new `version`. Type: `ReportEnvelope`, `cli/src/contexts/telemetry/application/report/report-envelope.ts`.

| Field | Meaning |
| --- | --- |
| `version` | `1` |
| `period` | `{from, to}`, UTC days, `null` for open |
| `axis` | `total`, `person`, `session`, `model`, `agent`, `day`, `repository`, `task`, `ticket` |
| `rows` | one per axis value |
| `totals` | the whole period |
| `unknown_records` | calls with at least one counter unknown |
| `coverage` | `files_read`, `records`, `unrecognised_shapes`, `not_stored`, `consent_log_damaged`, `oldest_transcript_at`, `skipped_ledger_lines` |

Row and `totals`: `records`, `input`, `output`, `cache_read`, `cache_write` (each `{tokens, unknown_records}`), `total`. A row also has:

| Field | Values |
| --- | --- |
| `kind` | `value`, `unattributed`, `absent` |
| `key` | axis value for `value`, else `null` |
| `reason` | `no-binding` or `declared-none` for `unattributed`, else `null` |

- Every axis partitions the same calls: each adds up to `totals`, counter by counter.
- `AIDD_TELEMETRY=0`: nothing read, object is `{"version": 1, "refused": "AIDD_TELEMETRY=0"}`.
- A report ingests first. `files_read` and `unrecognised_shapes` describe that run; `records` the period.
- No path, working directory or branch. `session` keys are full session ids, `repository` keys are hashes.

## Stores

Directory: `AIDD_TELEMETRY_DIR`, else `AIDD_USER_CONFIG_DIR/telemetry`, else `XDG_CONFIG_HOME/aidd/telemetry`, else `~/.config/aidd/telemetry`. Empty means unset. CLI (`runtime/wiring/telemetry.ts`) and hooks (`hooks/lib/telemetry-dir.cjs`) share the rule, pinned by `scripts/__tests__/fixtures/telemetry-bindings/`. Created private.

| Store | Writer | Readers | Holds |
| --- | --- | --- | --- |
| `ledger/<YYYY-MM-DD>.jsonl` | `ingest`, `report` | `report`, `forget` | `StoredUsage` by UTC day of `at`, in time then key order, one call per line. Ingest reads its calls' days and the day on each side, and rewrites only a changed day, whole, by rename; no new bytes, no write. `report` rewrites, folded, the partitions that share a call or hold a line that is not a record. A monthly `<YYYY-MM>.jsonl` from an earlier version is still read, split into its days by the first ingest whose window touches it or by a report, then removed |
| `ledger/offsets.json` | `ingest`, `report` | same | per transcript: bytes consumed, size, file identity. Shrunk or changed identity: read whole |
| `ledger/roots.json` | `ingest`, `on` | `ingest`, `forget` | `{version: 2, directories}`: per directory and per clone seen alive there, `repository_id`, `root`, `clone`, `seen_at`. Other format holds nothing: a live directory is remembered again, a gone one counts `never-seen-alive`. `on` records its own root for `forget` |
| `ledger/consents.jsonl` | `on`, `off`, `ingest`, hooks (close only) | same, plus `forget` | consent intervals, see [Consent](#consent). Outlives the clone; removed with the ledger. Hooks parse it strictly, pinned by the shared fixture |
| `ledger/.lock` | CLI | CLI | `{pid, created_at}`; dead process or older than ten minutes: cleared |
| `bindings/.lock` | CLI | CLI | same format. Declarations and snapshots run under it; `task` never takes the ledger lock, which an ingest holds while reading transcripts |
| `bindings/sessions.jsonl` | `task` | hooks, `report`, `task` | `{session_id, task, ticket, none, declared_at, by}`, `by` = `command` \| `hook-intercept` |
| `bindings/branches.jsonl` | `task`, `ingest`, `report` | `report`, `forget` | branch declaration at a moment, with branch creation time from its reflog |
| `bindings/carries.jsonl` | `SessionStart` hook | hooks, `report` | `{session_id, from, at}` |
| `bindings/processes.jsonl` | `SessionStart` hook | `SessionStart` hook | `{pid, session_id, source, at}` |
| `identity.json` | `identity` | `report` | `{"person_id": "<id>"}`, owner-only |
| git config `--local` `branch.<name>.aiddTask`, `aiddTicket`, `aiddDeclaredAt` | `task` | hooks, `task`, `report` via snapshots | branch declaration; follows a rename, leaves with the branch |
| git config `--local` `aidd.telemetry` | `on`, `off`, `forget` | hooks, CLI | `2:<token>` or `off`. Half of consent: alone it grants nothing |

- A line not exactly its store's format is skipped, never guessed. Every JSON Lines store is append-only except the ledger.
- `forget` removes `ledger/`, `bindings/`, `identity.json`, declaration keys and consent key in each recorded clone, and leftovers of an earlier measurement. Never the directory itself.

## Attribution

Task and ticket come only from `aidd telemetry task <name> [--ticket <ref>]` or `--none`. No branch name, folder, commit message or prompt is parsed. A ticket is free text, kept as typed.

A declaration binds the running session (if `CLAUDE_CODE_SESSION_ID` is set) and, on a working branch, the branch. Never bound: the default branch (target of `origin/HEAD`, else `main` or `master`) and a detached `HEAD`.

```mermaid
flowchart TD
  A["call"] --> S{"session declaration in force?"}
  S -->|"yes"| T1["its task"]
  S -->|"no"| C{"session carry?"}
  C -->|"yes"| T2["carried task"]
  C -->|"no"| B{"branch declaration?"}
  B -->|"yes"| T3["branch task, any call since branch creation"]
  B -->|"no"| U["unattributed, no-binding"]
```

- A declaration of no task is `declared-none`.
- Declaring a branch late moves its earlier calls onto the task.
- Sub-agent and advisor calls follow their parent session.

## Ask

`UserPromptSubmit` (`hooks/prompt-gate.cjs`) blocks a prompt before the model when all hold:

| Condition | Test |
| --- | --- |
| Claude's own payload | `session_id` = `CLAUDE_CODE_SESSION_ID`, `transcript_path` under a `projects` directory |
| clone measured | consenting per [Consent](#consent), `AIDD_TELEMETRY` not `0` |
| person present | `CLAUDE_CODE_SESSION_ATTENDED=1` and `CLAUDE_CODE_ENTRYPOINT` is `cli` or `claude-desktop` (surfaces seen showing a hook message; an IDE extension is not asked, VS Code seen showing none) |
| work undeclared | working branch, no declaration for session or branch |
| CLI usable | `aidd` on `PATH` and knows `telemetry task` |

- Anything else passes. A crash exits 0: the hook never fails a prompt.
- Asks once per working branch; switching to an unbound branch asks again.

Answering never blocks and never reaches the model:
- `! aidd telemetry task ...` in the terminal fires no `UserPromptSubmit`.
- `aidd telemetry task ...` typed as a prompt runs through the CLI with `--by hook-intercept`. Block reason: one line, what was declared, "Send your prompt again."
- Grammar: a name, `--ticket <ref>`, `--none`, nothing else. Outside it nothing runs.
- A one-line prompt starting like a declaration, only words and quoted strings, no `?`, `!`, comma or final full stop (`aidd telemetry task fix cart`) is blocked with the grammar and quoting hint, kept visible. Any other prompt starting with those words is ordinary.

## Carry

`/clear` and `/branch` (source `fork`) start a new session in the same process; the payload names no predecessor. The `SessionStart` hook (`hooks/session-start.cjs`) records every start.

```mermaid
sequenceDiagram
  participant P as Claude process
  participant H as SessionStart hook
  participant B as bindings
  P->>H: start, source and session_id
  H->>B: append pid, session_id, source, at
  alt source clear or fork, previous session of pid newer than boot, and bound
    H->>B: append carry session_id, from, at
    H-->>P: Task kept after /clear
  end
```

- pid: `CLAUDE_PID`, else the hook's parent. Boot guard because process ids are reused across boots; it is the boot time only, not the process start time.
- Message: `Task <task> kept after /clear. Different work: aidd telemetry task <name> [--ticket <ref>]`.
- `startup`, `resume`, `compact` carry nothing.
- Provisional: the session's first declaration replaces it for the whole session, earlier calls included. An uncarried session is bound from its declaration on.

## Consent

> A call is stored only when all hold:
> 1. its directory was seen alive belonging to clone X;
> 2. X had an open consent interval at the call's time;
> 3. `AIDD_TELEMETRY=0` is not set.

Nothing else: no backfill, no first-`on` special case, no interval before its `on`, no consent flag elsewhere, no live-key condition on a live clone. **Measurement starts at `on`**; `on` reads nothing back. A transcript last written more than a day before the first interval opened is not read nor counted (the day absorbs a lagging file clock). Every clause is decided from observed facts, never from a path or a remote's look.

```mermaid
stateDiagram-v2
  [*] --> Unmeasured
  Unmeasured --> Open: on, key 2-token then open line
  Open --> Closed: off, close line then key off
  Open --> Closed: ingest or hook sees key not naming it
  Open --> Closed: ingest sees another identity at path
  Closed --> Open: on, fresh token
```

**Clone identity.**
- Its git common dir: `dev`, `ino`, `birthtimeMs` of `fs.stat` on its real path, plus the path. Recorded in `roots.json` when first seen alive.
- No identity (call `unreadable-consent`): `ino` `0` or missing, or any `stat` error other than not-found. One unreadable clone never aborts an ingest or report.
- Another identity at a remembered path: the remembered clone is gone; the new one never answers for its calls.
- Several clones at one directory: one entry each. A call goes to the latest clone born at or before it (birth time, else first seen), else the first. Owning a call does not store it: the owner's interval must cover it, and none opens before the clone's `on`.

**Interval log** `ledger/consents.jsonl` (shared fixture, `consentLog` cases):

| Line | Shape |
| --- | --- |
| open | `{"token": "<uuid>", "clone": {"path", "dev", "ino", "birthtimeMs"}, "open": "<ISO-8601 UTC>"}` |
| close | `{"token": "<uuid>", "close": "<ISO-8601 UTC>"}` |

- Opened once; a second open is ignored.
- Several closes: the earliest wins, whatever line order (ingest and hooks both append).
- Close of a never-opened token: no effect. Blank line: not damage.
- Half-open: `on` at T covers T, `off` at T does not.

**Who writes what.**

| Actor | Does |
| --- | --- |
| `on` | under the ledger lock: fresh token, key `2:<token>` first, then open line (a key with no interval measures nothing; an interval its key does not name would be closed by the first hook). Key naming an open interval of this clone: no change. Otherwise closes this clone's stale open intervals at its time. Refuses a clone with no identity |
| `off` | under the same lock: close the clone's open token, then key `off`; key and interval change together, so an ingest never sees one without the other. Also closes the interval its key names at its path, whatever identity it reads there |
| ingest | before judging any call, for every open interval, closes at observation time when the identity at its path changed or the live key is not `2:<that token>`. Nothing at the path: not closed (unmounted volume, folder moved and back); measured again when back. Unreadable config or `stat`: stays open, stores nothing |
| hooks | after the Claude-only guard, even headless: key not naming an open interval recorded for this clone's real path => append a close at hook time. Ends a manual `git config aidd.telemetry off` or `--unset` before the next prompt's calls. `AIDD_TELEMETRY=0`: does nothing |
| `forget --yes` | removes the log with the ledger; unsets the key in every recorded clone |

**Consenting, for hooks and `task`.** All three: key is `2:<token>`; log holds an open interval with it; that interval's clone is this one, by common-dir real path and by `dev`, `ino`, `birthtimeMs`, normalised as the CLI does (inode as text, missing birth as `0`, any other kept even if equal to change time, no inode = no identity; fixture `cloneIdentity` and `hookConsent` cases). Not consenting: a hand-set key (`2`, made-up token), a `cp -R` copy, a copy moved onto a deleted original's path, a clone remade at a path, a moved clone. There: nothing asked, nothing blocked, nothing closed that is not this clone's; run `aidd telemetry on`.

**The key.**
- `--local` writes the common config: shared by linked worktrees, never committed. A teammate who pulls is not measured, asked or blocked until their own `on`.
- `.aidd/config.json` is never consent: not `telemetry: {enabled: true, version: 2}`, not the old bare `enabled: true`. Not read for consent.
- Unreadable git config: `unreadable`, grants nothing, never rewritten.
- A clone that never opted in: nothing stored, asked or blocked.

**`on` also:** removes the old `telemetry` block from `.aidd/config.json` byte-for-byte otherwise, deleting the file only if that block was all (says the change may need committing); removes an earlier measurement's leftovers in the repository; records its clone for `forget`; warns when Claude Code's transcript retention is short; ends with the next step, declaring a task, which the hooks ask for in Claude Code. Does not reset offsets.

**`forget --yes`** unsets `aidd.telemetry` and branch task keys in every clone in `roots.json` or `consents.jsonl` that still exists. Names only gone clones that had consented. A clone that never ran `on` is recorded only if a call from it was read after some clone opted in, so a hand-set key there may stay.

**Fail closed.**
- A terminated `consents.jsonl` line not exactly one of the two shapes: log untrusted. Storage refused for every clone; `on` and `off` refuse and change nothing; every `ingest` and `report` says so, `coverage.consent_log_damaged` in `--json`. Calls read meanwhile are lost (offsets move on).
- An unterminated last line is not a line yet (cut write, or still writing): both readers ignore it, even if it parses. The next writer, CLI or hook, cuts it off before appending. A lost close is re-observed; a lost open leaves a key with no interval, measuring nothing.
- Recovery: `aidd telemetry forget --yes`, then `aidd telemetry on` per clone. Safe: `forget` removes the log and offsets, no backfill, intervals open at `on`. Removing the line by hand is not recovery and is no longer suggested: a lost close would reopen a window turned off.

## Residual limits

None observable by the CLI.

| Case | Effect | Mitigation |
| --- | --- | --- |
| Key changed by hand, then no hook or ingest before next `on` | interval stays open until observed; calls before observation covered, after turning off included | any session start, prompt or ingest observes it |
| Machine clock | judged by transcript timestamp. Stamped inside an interval: covered whenever written; future-dated: covered by an open interval; outside: by stamp alone. File mtime more than a day behind its calls (set back, lagging network fs): not read. Copied transcripts: read only if written after first local `on`, stored only for a clone opted in here | - |
| Worktree made and removed between two ingests | `never-seen-alive` | the session start inside it sees it alive |
| No birth time | a clone reusing a deleted clone's path and inode is taken for it; of two at one directory, the later is told apart only from first seen | - |
| Linux refuses `statx` (seccomp, kernel before 4.11) | birth = change time; identity moves on any git dir entry change, `on` included; clone stops being measured and asked | fails closed: `off` closes by key token at path |
| Moved or renamed clone | new clone. Old interval open while path empty, closed when another directory appears; nothing stored or asked at new path until `on`. Back at same path, same identity: same clone, still measured | - |
| Consent log edited by hand | outside the contract; can reopen a window `off` closed | tool says `forget --yes` |
| Call read while git config, `.git` or git dir unreadable | `unreadable-consent`, offsets move on: not recovered on repair | - |
| pid reused within one boot by a Claude process whose `startup` was never recorded (e.g. started before `on`) | can take the dead process's last session as predecessor, so `/clear` carries its task | announced, replaced by first declaration |
| `AIDD_TELEMETRY=0` | stops hooks too; a key turned off meanwhile is observed at the next run without it | - |

## Never leaves the machine

Release 1 opens no network connection, in the telemetry context or the hooks. `forget --yes` removes everything.

- Local only: ledger `cwd` and `git_branch`, roots, process facts, transcripts.
- Text report: no path, branch, working directory or whole session id (short keys); envelope per [Report envelope](#report-envelope). `task`, `status`, `forget` print what they act on (a branch: `Branch feat/x is bound.`; `forget` lists entries and repositories); the lock error names the lock file.
- Identity only if chosen with `aidd telemetry identity <id>`; labels the `person` axis only.
- No currency amount: the destination owns the price table.
