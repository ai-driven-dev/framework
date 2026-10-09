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

An unknown value is `null`, never `0`. A report leaves a call out of a counter's sum when the counter is `null`, and counts it in that counter's `unknown_records`. A line whose shape the reader does not recognise is counted in `coverage.unrecognised_shapes` and never turned into a record.

### Key and fold rule

- Claude Code key: `message.id:requestId`; a line with no `requestId` uses `message.id:sessionId:timestamp`; each advisor iteration adds `#advisor<n>`.
- A call is written several times (streamed snapshots, resumed sessions, sub-agents). One record is kept per `(tool, key)`: the largest total of the four counters, a counter that is `null` counting as `0` for this comparison only. A tie goes to the earliest `at`, then the lowest `session_id`, then the serialised record. No input order changes the winner.
- Reading Claude Code lines (`domain/formats/claude-transcript-usage.ts`):
  - a `<synthetic>` model is dropped;
  - `cache_write` is summed over the `message` iterations, because the top-level split reflects only the first;
  - each `advisor_message` iteration is its own record with `agent: advisor` and its own model;
  - `isSidechain` or an `agentId` makes the call a `subagent`.

### Repository

A call's repository is its working directory resolved at ingest: the directory's git root, named by the hash of the `origin` address (`host/owner/repo`), else the root commit. The address itself is never kept. A call is stored only when its project opted in. A call read and left out is counted in `coverage.not_stored` under one reason: `outside-repo`, `never-seen-alive`, `no-consent`, `unreadable-consent`, `no-cwd` or `undated`.

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
| `coverage` | `files_read`, `records`, `unrecognised_shapes`, `not_stored`, `oldest_transcript_at`, `skipped_ledger_lines` |

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
| `ledger/<YYYY-MM>.jsonl` | `ingest`, `report` | `report`, `forget` | one `StoredUsage` per line, by the month of its `at`; a changed month is rewritten whole by rename |
| `ledger/offsets.json` | `ingest`, `report` | `ingest`, `report` | per transcript: bytes consumed, size, file identity; a file that shrank or changed identity is read whole; `on` resets it |
| `ledger/roots.json` | `ingest`, `on` | `ingest`, `forget` | per working directory: `repository_id`, `root`, whether the project had opted in |
| `ledger/.lock` | the CLI | the CLI | `{pid, created_at}`; a lock of a dead process, or older than ten minutes, is cleared |
| `bindings/sessions.jsonl` | `task` | hooks, `report`, `task` | `{session_id, task, ticket, none, declared_at, by}`; `by` is `command` or `hook-intercept` |
| `bindings/branches.jsonl` | `task`, `ingest`, `report` | `report`, `forget` | a branch declaration at one moment, with the branch's creation time from its reflog |
| `bindings/carries.jsonl` | the `SessionStart` hook | hooks, `report` | `{session_id, from, at}` |
| `bindings/processes.jsonl` | the `SessionStart` hook | the `SessionStart` hook | `{pid, session_id, source, at}`; no CLI reader |
| `identity.json` | `identity` | `report` | `{"person_id": "<id>"}`, written owner-only |
| `branch.<name>.aiddTask`, `aiddTicket`, `aiddDeclaredAt` in the repository's git config, `--local` | `task` | hooks, `task`, `report` via snapshots | a branch declaration; it follows a branch rename and goes with the branch |
| `.aidd/config.json`, key `telemetry` | `on`, `off` | hooks, the CLI | the project's consent |

- A line that is not exactly the format of its store is skipped, never guessed at. Every JSON Lines store is append-only except the ledger.
- `forget` removes `ledger/`, `bindings/`, `identity.json`, the declaration keys in each repository's git config, and what an earlier measurement left. It never removes the telemetry directory itself, nor the project consent.

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
- the project opted in, and `AIDD_TELEMETRY` is not `0`;
- a person is present: `CLAUDE_CODE_SESSION_ATTENDED` is `1` and `CLAUDE_CODE_ENTRYPOINT` is set and does not start with `sdk`. Both are undocumented, so either missing or different means nobody is asked, never that work is blocked;
- the branch is a working branch, with no declaration for the session or the branch;
- `aidd` is on `PATH` and knows `telemetry task`. Without it nothing is asked.

Anything else passes. The hook never fails a prompt: a crash exits 0.

Answering is never blocked and never reaches the model:

- `! aidd telemetry task ...` in the terminal fires no `UserPromptSubmit`;
- `aidd telemetry task ...` typed as a prompt is run by the hook through the CLI with `--by hook-intercept`, and its result is the block reason. The grammar accepts a name, `--ticket <ref>` and `--none` and nothing else; a prompt outside it runs nothing.

The block asks once per working branch, since the declaration it gets is remembered. Switching to an unbound branch asks again.

## The carry rule

`/clear` and `/branch` start a new session in the same Claude process, and the payload names no predecessor. The `SessionStart` hook (`hooks/session-start.cjs`) records `(pid, session_id, source, at)` for every start, with the process id from `CLAUDE_PID`, else the hook's parent.

- On `source` `clear` or `fork` (`/branch`), the predecessor is the process's previous session, if its fact is newer than the machine's boot (process ids are reused across boots).
- If that session is bound, a carry `{session_id, from, at}` is appended and the person is told: `Task <task> kept after /clear. Different work: aidd telemetry task <name> [--ticket <ref>]`.
- `startup`, `resume` and `compact` carry nothing.
- A carry is provisional. The first declaration made in the carried session replaces it for the whole session, retroactively, calls made before it included. A session that was not carried is bound from its declaration onward and no earlier.

## Consent, version 2

A project opts in with `aidd telemetry on`, which writes `telemetry: {enabled: true, version: 2}` to `.aidd/config.json`, keeping every other key. Only that pair is consent:

- a bare `enabled: true` is not consent;
- a file that does not parse is `unreadable`, grants nothing, and is never rewritten;
- a linked worktree with no config of its own takes the main working tree's;
- `AIDD_TELEMETRY=0` refuses measurement whatever a project granted;
- `off` sets `enabled: false` and keeps the version;
- a project that never opted in has nothing stored, nothing asked and nothing blocked.

`on` also removes what an earlier measurement left in the repository, and warns when Claude Code's transcript retention is short.

## What never leaves the machine

Release 1 sends nothing anywhere: no code in the telemetry context or the hooks opens a network connection. Everything above lives on the machine, and `aidd telemetry forget --yes` removes it.

- Local only, never to be sent: `cwd` and `git_branch` in the ledger, the roots in `roots.json`, the process facts, the transcripts themselves.
- Printed text names no path, branch, working directory or whole session id.
- The person's identity exists only if they chose one with `aidd telemetry identity <id>`; it labels the `person` axis and nothing else.
- A currency amount is never computed here: the destination owns the price table.
