# Usage contract

> For: maintainers, hook authors, a later destination. What `aidd telemetry` records, stores and reports for Claude Code and Codex. How to use it: [plugin README](../../plugins/aidd-telemetry/README.md). Where the code is: [`cli/aidd_docs/memory/telemetry.md`](../../cli/aidd_docs/memory/telemetry.md).

The code is the authority. A change to a format below changes this page in the same commit.

| Part | Owns |
| --- | --- |
| CLI, `cli/src/contexts/telemetry/` | reading, storing, attributing, reporting |
| Plugin hooks, `plugins/aidd-telemetry/hooks/`, plain Node | asking for a task, answering it, recording session facts |

Claude Code and Codex are measured, each from the files it writes itself. Reading is the only part written per tool: resolving, consent, storing, attribution and the report are written once for both.

```mermaid
flowchart LR
  T["Claude Code transcripts, Codex session files"] -->|"ingest"| L[("ledger")]
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
- A line of a shape the reader does not recognise is never a record. For Claude Code: one that is not JSON or not an object, or an `assistant` line whose `message.usage` is not an object or that lacks `message.id`, `sessionId` or `timestamp`. It counts in `run.unrecognised_shapes` of the report that read it, and, when it names a clone that consents, in `coverage.left_out.unrecognised` of every report (see [Left out](#left-out)). A line that is not `assistant`, has no `message.usage` or names the model `<synthetic>` is no call at all, and counts nowhere. For Codex, see [Codex](#codex).
- Ingest and report say: "not recognised by this read: a call missing a counter is kept with that counter unknown; a line that is no usage line is never a call." (`UNRECOGNISED_WORDS`, `presentation/display/telemetry-display.ts`). What is kept of such lines is said apart: "Kept from every read: …".

**Key and fold** (`domain/formats/claude-transcript-usage.ts`).

| Rule | Value |
| --- | --- |
| Key | `message.id:requestId`; each advisor iteration adds `#advisor<n>`. A call with no `requestId` is not stored (see [Left out](#left-out)) |
| Fold | a call is written several times (streamed snapshots, resumed sessions, sub-agents); one record per `(tool, key)`: largest sum of the four counters (`null` as `0` for this comparison only) |
| Tie | earliest `at`, then lowest `session_id`, then serialised record. No input order changes the winner |
| Dropped | model `<synthetic>` |
| `cache_write` | summed over `message` iterations (the top-level split reflects only the first) |
| Advisor | each `advisor_message` iteration is a record, `agent: advisor`, own model |
| Sub-agent | `isSidechain` or an `agentId` |

### Codex

Read from `CODEX_HOME`, else `~/.codex`: every `rollout-*.jsonl` and `rollout-*.jsonl.zst` under `sessions/` and `archived_sessions/`, at any depth (`domain/formats/codex-transcript-usage.ts`, `infrastructure/transcripts/codex-transcript-source-adapter.ts`). Archiving moves a file, and Codex compresses one it no longer writes to `.jsonl.zst` and removes the `.jsonl`: either way its calls are the same keys, so the ledger takes them once.

Only a `token_usage_record` line is a call. Every other line is context or nothing, and never left out.

| Record field | From |
| --- | --- |
| `key` | `payload.response_id` |
| `session_id` | `payload.session_id`: the root session, also on a sub-agent's call |
| `agent` | `subagent` when `payload.thread_id` differs from `payload.session_id`, else `main` |
| `at` | the line's `timestamp` |
| `input` | `usage.input_tokens − usage.cached_input_tokens − usage.cache_write_input_tokens`; `null` unless all three are counts |
| `cache_read`, `cache_write` | `usage.cached_input_tokens`, `usage.cache_write_input_tokens` |
| `cache_write_1h` | `null`: Codex does not say |
| `output`, `reasoning` | `usage.output_tokens` (reasoning included), `usage.reasoning_output_tokens` |
| `model`, `cwd` | of the latest `turn_context` before the line; `cwd` else of the file's first `session_meta`; `model` else `null` |
| `tool_version`, `git_branch` | `cli_version` and `git.branch` of the file's first `session_meta`: a sub-agent's file carries its parent's after its own |

- Only `payload.usage` is read. `turn_token_usage`, `thread_token_usage` and `event_msg` `token_count` are running totals: reading them would count a call many times.
- A missing or malformed counter is `null` and said, as for Claude Code.
- A `token_usage_record` with no `response_id`, `session_id`, `thread_id`, `timestamp` or `usage` object, or a line that is not JSON and holds the text `token_usage_record`, is unrecognised, named with the directory its context gives and its time.
- Lines are cut on byte `0x0a` only: a line holds U+2028 and U+2029 unescaped.
- A call's directory and model are written before it. A `.jsonl` that moved is read from its start: the lines before the saved offset only build its context, the lines after it give calls and unrecognised shapes exactly as a read from that offset would. For a `.jsonl`, `offsets.json` keeps its meaning, the end of the last complete line consumed.
- A `.jsonl.zst` is read whole, once, decompressed as a stream: its offset is its size, and its size and identity keep it read. Its bytes are counted against the content size its frame header declares, since a Node 22 `zlib` ends a cut frame quietly, short. A Node whose `zlib` has no zstd reads none, and one that does not decompress, or decompresses to another size than its frame declares, is not read: each counts in that run's unrecognised shapes, saying why, keeps its position and is tried again by the next run. Nothing else stops for it.
- A `.jsonl` and a `.jsonl.zst` of one session may lie side by side, or one turn into the other: both are read and the ledger takes each call once, `left_out` each thing once. Only the run that reads the second counts its unrecognised shapes and calls not stored again.

**Repository.** The call's working directory resolved at ingest: its git root, named by the hash of the `origin` address (`host/owner/repo`), else the root commit. The address is never kept. Every form (https, `ssh://`, `git://`, scp-like) gives one address: scheme, credentials, port, `.git` and trailing `/` dropped, host case-folded, `ssh.github.com` read as `github.com`. Owner and repo are case-folded on `github.com` only, which documents them as not case sensitive; any other host keeps their case, so two spellings there may still give two ids.

**Not stored.** Storing follows [Consent](#consent). A call read and left out counts in `run.not_stored` of the report that read it, under one reason, and nothing of it is kept, except an `undated` call of a clone that consents (see [Left out](#left-out)). A call with no `requestId` is not stored either, and counts under no reason here: only in `coverage.left_out.requestless`.

| Reason | When |
| --- | --- |
| `outside-repo` | no git root, or a repository with neither origin nor root commit |
| `never-seen-alive` | directory gone, never seen alive |
| `no-consent` | clone had no consent at that time: not opted in yet, or turned off |
| `consent-closed` | its live key names a closed interval; says "run `aidd telemetry on`", never says the clone has not opted in |
| `unreadable-consent` | git config or `.git` unreadable, directory or git dir the file system will not let ingest look at, clone with no identity, damaged consent log |
| `no-cwd` | no working directory |
| `undated` | timestamp not a readable date, with no zone (`Z` or `±hh:mm`), or outside four-digit years |

### Left out

What an ingest measured and could not store is kept in `ledger/left-out.txt`, so every report says it, whoever ran the ingest: `aidd telemetry ingest --quiet` from the plugin's hook prints nothing and moves the offsets on.

| Left out | Kept as |
| --- | --- |
| A call `undated`, of a clone that consents at the time of the read | `undated <hash>`, 41 bytes: a hash of its tool and key |
| A line that is no usage line, naming the directory of a clone that consents at the line's own time or, with none, at the time of the read | `unrecognised <hash>`, 46 bytes: a hash of the line |
| A call with no `requestId`, of a clone that consents at its time | `requestless <hash>`, 45 bytes: a hash of its tool, message id and session, one for all its copies and iterations |

- A call with no `requestId` has nothing measured to bound how far apart its copies are written, so it is not stored. None was seen: 0 of 512,820 usage lines, and 0 of 265,472 measured again (Claude Code 2.1.232 to 2.1.302). One an earlier version stored is left out by the migration's one pass over the ledger; one an older CLI stores after it is a line this version does not accept, kept as found and counted in `skipped_ledger_lines`. The reason is defined in [the envelope reference](../../plugins/aidd-telemetry/skills/01-usage/references/envelope.md).

- What consent or scope excludes is not measured: a call of a clone that never opted in, made after `off`, outside any repository, in a directory never seen alive, with no directory, or while consent cannot be read, leaves nothing here. Neither does a line that names no directory, nor one of such a clone: the run that read it still counts it in its own `unrecognised_shapes`.
- A call whose consent cannot be read yet (`unreadable-consent`: git refused the `.git`, a config that does not parse, a git dir the file system will not show) is not a no when a clone `roots.json` remembers at that directory, seen while it could be read, consented at the call's time (or, for an undated call or a line with no time, at the read). Then ingest keeps the transcript's position from before that read, so the next ingest, a report's included, reads it again: the call is stored, or the undated call or line kept, once its consent can be read, and until then every run counts it. Otherwise (a directory no read saw readable, a repository that never opted in, a call made while its clone did not consent) the transcript moves on and only that run says it: once readable it could never be stored, so a hold would never end. A damaged consent log moves on too: it stays damaged until `forget`, which removes it, so a hold would never end. Cost: while a clone that consents stays unreadable, the part of its transcripts read since is read again by every ingest. A hold ends when the clone can be read again, when `forget --yes` removes `roots.json` and the offsets, or when the clone is removed (its directory then gone); `off` does not end it, since `off` refuses a clone whose config cannot be read. Inferred, not measured: if that re-read alone outlasts the hook's 110 s limit on `ingest`, the hook's runs are killed before they save any position, and measurement stalls for every clone until the hold ends or a report runs without that limit.
- A call of a directory gone before any ingest saw it alive (`never-seen-alive`, a worktree made and removed between two ingests) is counted only by the run that read it, which for the hook is nobody. Its consent is unknown, so nothing of it is kept; and the directory never comes back, so reading it again would never end. This is a stated loss.
- Resolving the directory of an undated call or of such a line remembers it in `roots.json` when it is alive, in any clone, as a dated call's always has: the directory, its clone and when it was first seen, never the call.
- One line each, the hash of the reason and of what the thing is, sha-256 cut to 32 hex characters, in text order, each once: a re-read, a reset of offsets or a second ingest adds nothing. No key and no transcript text in clear. A line of the file this version does not know is kept and not counted. `forget` removes it with `ledger/`.
- None of it has a day: every report counts all of it, in `coverage.left_out`, bounded or not.
- A call missing a counter is stored with that counter `null`, counted in `unknown_records`, and kept nowhere else.
- Limits: two lines that are no usage line with one text count once. A call is assumed to have all its copies dated or all undated: one read with a dated copy and another with an undated one would both store it and keep it. Nothing measured before this version was kept.

## Report envelope

`aidd telemetry report --json` prints one object, `version: 2`. Every field, what a figure is, what it depends on, what `run` holds, and how the envelope may change are defined once, in [the envelope reference](../../plugins/aidd-telemetry/skills/01-usage/references/envelope.md). Type: `ReportEnvelope`, `cli/src/contexts/telemetry/application/report/report-envelope.ts`. What the reference does not say:

- Envelope version 1 put the figures and the run together. Version 2 keeps them apart and has no compatibility shape.
- `AIDD_TELEMETRY=0`: nothing read, object is `{"version": 2, "refused": "AIDD_TELEMETRY=0"}`.
- The text report labels an `absent` person `anonymous`; the envelope keeps `kind: absent`, `key: null`.
- A report ingests first: what that read found is its `run`.
- A report with `--days`, `--from` or `--to` reads only the days of its period and the day on each side; with none it reads the whole ledger. The copies of a call have been observed less than a day apart, and under that bound both print the same figures; past it, only a report with no period folds every copy of a call.
- No path, working directory or branch. `session` keys are full session ids, `repository` keys are hashes.

### Filters

Every row a report prints can be selected, and the report it selects adds up to that row. A filter keeps a call when the axis it names gives that call exactly the value named, by the same function that builds the rows. A `day` row is selected by the period, `--from D --to D`; the `total` row by no filter.

| Flag | Keeps the calls whose | Value |
| --- | --- | --- |
| `--task <name>` | `task` is that value | a task name |
| `--ticket <ref>` | `ticket` is that value | a ticket, as declared |
| `--person <id>` | `person` is that value | the identity |
| `--model <id>` | `model` is that value | a model id |
| `--agent <agent>` | `agent` is that value | `main`, `subagent`, `advisor` |
| `--session <id>` | `session` is that value | a session id, or a start of one |
| `--repository <id>` | `repository` is that value | a repository id, a start of one, or `.` |
| `--absent <axis>` | axis has no value | `person`, `model`, `ticket` |
| `--unattributed [reason]` | `task` and `ticket` are unattributed | `no-binding`, `declared-none`, or `any` (the default) |

- Flags combine with AND. Each takes one value; given twice, exit 1.
- One selector per axis: `--unattributed` selects on `task` and `ticket`, so it cannot be combined with `--task`, `--ticket` or `--absent ticket`; nor can a value and `--absent` of the same axis. Exit 1.
- A value is trimmed as a declaration is; empty once trimmed, exit 1. It is compared exactly, case included.
- A value outside a closed set (`--agent`, `--absent`, `--unattributed`) exits 1. A value of an open set that no call has gives an empty report, exit 0.
- `--session` and `--repository` resolve among the values of that axis in the calls of the period: a value equal to the one typed wins, else the one value it starts. Two or more: exit 1, listing them in full, sorted. None: an empty report, and `filters` prints the value as typed.
- `--repository .` names the repository the command runs in, by the rule ingest uses: its hosted `origin`, else its first commit. A linked worktree names its main tree's repository. Not a repository, gone, unreadable, or with neither: exit 1. It is compared in full, never as a start.
- Order: the flags are checked, then `AIDD_TELEMETRY=0` refuses (no git is run, the envelope has no `filters`), then `.` is located, then transcripts are ingested and the ledger read, then starts are resolved. Filters apply after attribution and after the period; the window a bounded report reads is unchanged.
- A task name belongs to no repository: `--task refactor` adds up every repository's `refactor`, as `--axis task` does. Add `--repository .` for one.
- The text report folds whitespace in a name onto one line. A filter compares with the stored value, which `--json` prints as `key`.
- `--repository .` names the repository as it stands now. Calls stored under an earlier `origin`, or before a remote was added, carry another id and are not selected; `--axis repository` lists them.
- `--person` is the identity of the machine reporting, as `--axis person` is: locally it selects every call or none.

## Stores

Directory: `AIDD_TELEMETRY_DIR`, else `AIDD_USER_CONFIG_DIR/telemetry`, else `XDG_CONFIG_HOME/aidd/telemetry`, else `~/.config/aidd/telemetry`. Empty means unset. CLI (`runtime/wiring/telemetry.ts`) and hooks (`hooks/lib/telemetry-dir.cjs`) share the rule, pinned by `scripts/__tests__/fixtures/telemetry-bindings/`. Created private.

| Store | Writer | Readers | Holds |
| --- | --- | --- | --- |
| `ledger/<YYYY-MM-DD>.jsonl` | `ingest`, `report` | `report`, `forget` | `StoredUsage` by UTC day of `at`, in time then key order, one call per line. Ingest reads its calls' days and the day on each side, and rewrites only a changed day, whole, by rename; no new bytes, no write. `report` rewrites, folded, the partitions it read that share a call, or hold a line that is not a record; a report with no period reads every partition, so after it each call is on disk once. A line that is not a record (a newer version's, an older one's call with no `requestId`, a hand edit, a torn one) is never removed: a rewrite keeps it in its day, after the records, in text order and once, and counts it in `skipped_ledger_lines` on every read. A day holding only such lines stays |
| `ledger/left-out.txt` | `ingest` | `report`, `forget` | what ingests measured and could not store, by hash, see [Left out](#left-out). cli-v5.5.0 never reads it |
| `ledger/repository-ids.json` | `ingest`, `report` | every reader of the ledger, `roots.json` and `branches.jsonl` | `{version: 1, complete, aliases, pending}`: the id an earlier version gave a repository, to its id now, both hashes or root commits. Made from each root `roots.json` names, by its `origin` now. Every read re-ids by this table; the first ingest or report also rewrites `roots.json` and every ledger partition so, then marks it `complete`. A run stopped part way is finished by the next with the same table. A root that could not be read, or was not there, stays in `pending`: every later ingest looks at those roots alone and, when one adds an id, rewrites the stores again. Until then its stored calls keep the earlier id while its new calls get the id of now: two ids for one repository. An earlier version reading migrated data reads it as written; what it stores afterwards is re-ided when its repository is in the table, at every read. `branches.jsonl` is never rewritten, so it relies on this table for good: a damaged table is made again from the clones still there, and a snapshot of a repository none of whose clones remains keeps its earlier id, so the calls of now no longer find its declaration. An `undated` hash in `left-out.txt` keeps its earlier key |
| `ledger/offsets.json` | `ingest`, `report` | same | per transcript: bytes consumed (for a `.jsonl.zst`, its compressed size), size, file identity. Shrunk or changed identity: read whole |
| `ledger/roots.json` | `ingest`, `on` | `ingest`, `forget` | `{version: 2, directories}`: per directory and per clone seen alive there, `repository_id`, `root`, `clone`, `seen_at`, for every directory a read call or line named, in any clone. Other format holds nothing: a live directory is remembered again, a gone one counts `never-seen-alive`. `on` records its own root for `forget` |
| `ledger/consents.jsonl` | `on`, `off`, `ingest`, hooks (close only) | same, plus `forget` | consent intervals, see [Consent](#consent). Outlives the clone; removed with the ledger. Hooks parse it strictly, pinned by the shared fixture |
| `ledger/.lock` | CLI | CLI | `{pid, created_at}`; dead process or older than ten minutes: cleared |
| `bindings/.lock` | CLI | CLI | same format. Declarations and snapshots run under it; `task` never takes the ledger lock, which an ingest holds while reading transcripts |
| `bindings/sessions.jsonl` | `task` | hooks, `report`, `task` | `{session_id, task, ticket, none, declared_at, by}`, `by` = `command` \| `hook-intercept` |
| `bindings/branches.jsonl` | `task`, `ingest`, `report` | `report`, `forget` | branch declaration at a moment, with when the branch took its name, from its reflog. Read with `repository-ids.json` applied, never rewritten |
| `bindings/carries.jsonl` | `SessionStart` hook | hooks, `report` | `{session_id, from, at}` |
| `bindings/processes.jsonl` | `SessionStart` hook | `SessionStart` hook | `{pid, session_id, source, at}` |
| `identity.json` | `identity`, `on` | `report`, `status`, `on` | `{"person_id": "<id>"}`, owner-only |
| git config `--local` `branch.<name>.aiddTask`, `aiddTicket`, `aiddDeclaredFor`, `aiddDeclaredAt` | `task` | hooks, `task`, `report` via snapshots | branch declaration, `aiddDeclaredAt` written last, `aiddDeclaredFor` = `<name>`; see [Branch declaration](#branch-declaration) |
| git config `--local` `aidd.telemetry` | `on`, `off`, `forget` | hooks, CLI | `2:<token>` or `off`. Half of consent: alone it grants nothing |

- A line not exactly its store's format is skipped, never guessed. Every JSON Lines store is append-only except the ledger, which keeps such a line through every rewrite.
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
- A branch snapshot with no `declared_at` attributes nothing.
- Sub-agent and advisor calls follow their parent session.

### Branch declaration

A branch is declared only when the command declared it on that branch. Both readers, the CLI (`parseBranchConfig`) and the hook (`lib/git.cjs`), apply the same rule, pinned by the shared fixture.

| git config of the branch read | Declared? | Why |
| --- | --- | --- |
| `aiddDeclaredAt` set, `aiddDeclaredFor` = this branch | yes | written by `task` on this branch |
| `aiddDeclaredAt` set, no `aiddDeclaredFor` | yes | written by cli-v5.5.0 or earlier, which did not stamp. Kept readable: reports and the gate do not change for data already written. Declaring again stamps it |
| `aiddDeclaredAt` set, `aiddDeclaredFor` = another branch | no | carried by `git branch -c` (copy) or `git branch -m` (rename), which move every `branch.<name>.*` key |
| `aiddTask` or `aiddTicket` without `aiddDeclaredAt` | no | set by hand, or a declaration cut short: `task` writes `aiddDeclaredAt` last |
| any declaration key listed twice | no | left by `git branch -C` or `-M` onto a branch that had keys: the copied declaration and the branch's own are mixed |

- **Rename** (`git branch -m A B`): B is undeclared (unless A's declaration is unstamped, see the limits), so the gate asks on B. One declaration on B covers B from when it took the name: the newest reflog entry renaming or copying a branch to B (git or libgit2), else B's oldest entry. Calls made while it was A keep A's task, and on a name used before, the earlier B keeps its own. git moves the keys the same way for a copy and a rename, so the stamp cannot tell them apart; the reflog could, but its entries expire and the declaration would change meaning with them: one question after a rename is the cost.
- **Copy** (`git branch -c A B`): B is undeclared until declared on B.
- **Copy or rename onto an existing branch** (`-C`, `-M`): git keeps both sets of keys, so some are listed twice and the two declarations mix. A branch with any declaration key listed twice is undeclared; declaring again replaces every value.

## Ask

`UserPromptSubmit` (`hooks/prompt-gate.cjs`) blocks a prompt before the model when all hold:

| Condition | Test |
| --- | --- |
| a tool's own payload | Claude Code: `session_id` = `CLAUDE_CODE_SESSION_ID`, `transcript_path` under a `projects` directory and no Codex session file. Codex: `session_id` set, `transcript_path` a Codex session file (`…/sessions/YYYY/MM/DD/rollout-…`), whatever `CLAUDE_CODE_SESSION_ID` says, since a Codex started inside Claude Code inherits it (`hooks/lib/tool.cjs`, fixture `hookTool`) |
| clone measured | consenting per [Consent](#consent), `AIDD_TELEMETRY` not `0` |
| person present | Claude Code: `CLAUDE_CODE_SESSION_ATTENDED=1` and `CLAUDE_CODE_ENTRYPOINT` is `cli` or `claude-desktop` (surfaces seen showing a hook message; an IDE extension is not asked, VS Code seen showing none). Codex: see below |
| work undeclared | working branch, no declaration for session or branch |
| CLI usable | `aidd` on `PATH` and knows `telemetry task` |

- Anything else passes. A crash exits 0: the hook never fails a prompt.
- Codex shows a block's reason in the TUI only (`codex exec` prints none; the desktop app shows it too, observed, and the IDE extension is unobserved), and hands a hook nothing that names its surface. The session file's first line does. A person is present only when all hold, anything else (a field missing, another value, an unreadable file, a first line longer than the 1 MiB read) being nobody to answer:
  - the first line of `transcript_path`, read up to 1 MiB, is a `session_meta` with `originator` `codex-tui`. Its `source` is `cli` on a bare config and `vscode` when plugins run the TUI through the app server, so `source` is not read, except that an object `source` (a sub-agent's own file) is refused. Codex writes it before it hands a hook the path; seen up to 48 KiB, base instructions included;
  - the payload has no `agent_id`: a sub-agent's spawn message reaches the hook with its root's `session_id`, and nobody typed it;
  - `permission_mode` is `default`: `codex exec` forces approvals off (`bypassPermissions`), and a TUI thread resumed by `codex exec` keeps its first line.
- Re-checked on every prompt: each prompt on an undeclared working branch is blocked until the branch or the session is declared (`--none` included). A declared branch is never asked again, unless a copy or rename onto it changes its keys; switching to an undeclared one asks.
- Why every prompt and not once: the gate exists so that no token of the work is spent before it has a task ([spec](../tasks/2026_10/2026_10_09_deterministic-tokens/spec.md), [target](../tasks/2026_10/2026_10_09_deterministic-tokens/context/target.md)). "Once per working branch" there meant answered once and remembered; letting the next prompt through would spend tokens unattributed.

Answering never blocks and never reaches the model:
- `! aidd telemetry task ...` in the terminal fires no `UserPromptSubmit`.
- `aidd telemetry task ...` typed as a prompt runs through the CLI with `--by hook-intercept`. Block reason: one line, what was declared, "Send your prompt again."
- The session it binds: `AIDD_TELEMETRY_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`, read by the composition root (`runtime/wiring/telemetry.ts`). The Codex hook sets the first, to its payload's `session_id`, for the command it runs; nothing else does. A sub-agent's calls carry their root's session, so they take its declaration.
- Claude Code hides the typed declaration from the transcript. Codex was never seen to accept that, so its block keeps the prompt shown; it is still never sent to the model.
- Grammar: a name, `--ticket <ref>`, `--none`, nothing else. Outside it nothing runs.
- A one-line prompt starting like a declaration, only words and quoted strings, no `?`, `!`, comma or final full stop (`aidd telemetry task fix cart`) is blocked with the grammar and quoting hint, kept visible. Any other prompt starting with those words is ordinary.

## Carry

`/clear` and `/branch` (source `fork`) start a new session in the same process; the payload names no predecessor. The `SessionStart` hook (`hooks/session-start.cjs`) records every Claude Code start. Codex gives a hook no process id, so for Codex it does nothing, not even the consent check: a Codex `/clear` or fork is a new session, asked again on an undeclared branch.

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

Nothing else: no backfill, no first-`on` special case, no interval before its `on`, no consent flag elsewhere, no live-key condition on a live clone. **Measurement starts at `on`**; `on` reads nothing back. One exception, with no time to be judged by: an undated call, or a line that is no usage line and has no time, is judged by its clone's consent at the read, and kept as a hash only if the clone consents then (see [Left out](#left-out)). A transcript last written more than a day before the first interval opened is not read nor counted (the day absorbs a lagging file clock). Every clause is decided from observed facts, never from a path or a remote's look.

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
| `on` | under the ledger lock: fresh token, key `2:<token>` first, then open line (a key with no interval measures nothing; an interval its key does not name would be closed by the first hook). Key naming an open interval of this clone: no change. Otherwise closes this clone's stale open intervals at its time. Refuses a clone with no identity. Then, only once on, writes the person's identity when one was chosen |
| `off` | under the same lock: close the clone's open token, then key `off`; key and interval change together, so an ingest never sees one without the other. Also closes the interval its key names at its path, whatever identity it reads there |
| ingest | before judging any call, for every open interval, closes at observation time when the identity at its path changed or the live key is not `2:<that token>`. Nothing at the path: not closed (unmounted volume, folder moved and back); measured again when back. Unreadable config or `stat`: stays open, stores nothing |
| hooks | after the tool guard, even headless (`session-start.cjs` excepted for Codex, where it does nothing): key not naming an open interval recorded for this clone's real path => append a close at hook time. Ends a manual `git config aidd.telemetry off` or `--unset` before the next prompt's calls. `AIDD_TELEMETRY=0`: does nothing |
| `forget --yes` | removes the log with the ledger; unsets the key in every recorded clone |

**Consenting, for hooks and `task`.** All three: key is `2:<token>`; log holds an open interval with it; that interval's clone is this one, by common-dir real path and by `dev`, `ino`, `birthtimeMs`, normalised as the CLI does (inode as text, missing birth as `0`, any other kept even if equal to change time, no inode = no identity; fixture `cloneIdentity` and `hookConsent` cases). Not consenting: a hand-set key (`2`, made-up token), a `cp -R` copy, a copy moved onto a deleted original's path, a clone remade at a path, a moved clone. There: nothing asked, nothing blocked, nothing closed that is not this clone's; run `aidd telemetry on`.

**The key.**
- `--local` writes the common config: shared by linked worktrees, never committed. A teammate who pulls is not measured, asked or blocked until their own `on`.
- `.aidd/config.json` is never consent: not `telemetry: {enabled: true, version: 2}`, not the old bare `enabled: true`. Not read for consent.
- Unreadable git config: `unreadable`, grants nothing, never rewritten.
- A clone that never opted in: nothing stored, asked or blocked. Nothing is kept of its calls in `left-out.txt` either; `roots.json` may name its directory, as for any directory read.
- Key `off`, from `off` or by hand: `status` and `task` say measurement was turned off in this clone and that `aidd telemetry on` measures it again; a damaged log or an unidentified clone reads unreadable instead, since `on` would refuse. Any other key that grants nothing reads as never opted in. Ingest still counts its calls under `no-consent`.

**`on` also:** removes the old `telemetry` block from `.aidd/config.json` byte-for-byte otherwise, deleting the file only if that block was all (says the change may need committing); removes an earlier measurement's leftovers in the repository; records its clone for `forget`; warns when Claude Code's transcript retention is short; ends with the next step, declaring a task, which the hooks ask for in Claude Code and the Codex TUI. Does not reset offsets.

**`forget --yes`** unsets `aidd.telemetry` and branch task keys in every clone in `roots.json` or `consents.jsonl` that still exists. Names only gone clones that had consented. A clone that never ran `on` is recorded only if a call from it was read after some clone opted in, so a hand-set key there may stay.

**Fail closed.**
- A terminated `consents.jsonl` line not exactly one of the two shapes: log untrusted. Storage refused for every clone; `on` and `off` refuse and change nothing; every `ingest` and `report` says so, `run.consent_log_damaged` in `--json`. Calls read meanwhile are lost (offsets move on).
- An unterminated last line is not a line yet (cut write, or still writing): both readers ignore it, even if it parses. The next writer, CLI or hook, cuts it off before appending. A lost close is re-observed; a lost open leaves a key with no interval, measuring nothing.
- Recovery: `aidd telemetry forget --yes`, then `aidd telemetry on` per clone. Safe: `forget` removes the log and offsets, no backfill, intervals open at `on`. Removing the line by hand is not recovery and is no longer suggested: a lost close would reopen a window turned off.

## Residual limits

None observable by the CLI.

| Case | Effect | Mitigation |
| --- | --- | --- |
| Key changed by hand, then no hook or ingest before next `on` | interval stays open until observed; calls before observation covered, after turning off included | any session start, prompt or ingest observes it |
| Machine clock | judged by transcript timestamp. Stamped inside an interval: covered whenever written; future-dated: covered by an open interval; outside: by stamp alone. File mtime more than a day behind its calls (set back, lagging network fs): not read. Copied transcripts: read only if written after first local `on`, stored only for a clone opted in here | - |
| Worktree made and removed between two ingests | `never-seen-alive`, said only by the run that read it: a hook's run says nothing | for a `claude --worktree` session, the session start inside it sees it alive; none for a subagent's worktree |
| A month file (`ledger/<YYYY-MM>.jsonl`) left by an unreleased build between #993 and #1031 | ignored: neither read nor reported | `aidd telemetry forget` removes the whole ledger |
| No birth time | a clone reusing a deleted clone's path and inode is taken for it; of two at one directory, the later is told apart only from first seen | - |
| Linux refuses `statx` (seccomp, kernel before 4.11) | birth = change time; identity moves on any git dir entry change, `on` included; clone stops being measured and asked | fails closed: `off` closes by key token at path |
| Moved or renamed clone | new clone. Old interval open while path empty, closed when another directory appears; nothing stored or asked at new path until `on`. Back at same path, same identity: same clone, still measured | - |
| Consent log edited by hand | outside the contract; can reopen a window `off` closed | tool says `forget --yes` |
| Call read while git config, `.git` or git dir unreadable | `unreadable-consent`. A clone remembered there that consented at the time: the transcript read again by every ingest until its consent can be read, then stored. Otherwise: said only by that run | repair the clone, or `forget --yes`, or remove the clone; not `off` |
| pid reused within one boot by a Claude process whose `startup` was never recorded (e.g. started before `on`) | can take the dead process's last session as predecessor, so `/clear` carries its task | announced, replaced by first declaration |
| One transcript line longer than the longest string the runtime holds (512 MB) | every ingest fails when it reaches that line (inferred, not run). A transcript is otherwise read a block at a time: an ingest holds 1 MiB, up to about three copies of the longest line, and what the reading keeps (every record, every unrecognised line naming a directory), whatever the transcript's size | - |
| Transcript rewritten in place, to the same size or larger, while an ingest reads it | not seen: a line may be spliced from the two versions and the offset saved inside the new one. Shrunk: that read counts nothing and the transcript is read again from where it stood. Replaced at its path: the read finishes the file it opened, and the next one reads the new file whole. Claude Code only appends; Codex is assumed to only append to a `.jsonl` | - |
| Codex hooks not trusted | Codex runs a plugin's hooks only once a person trusted each one, with `/hooks` in the TUI. The desktop app offers no review of its own: it skips an untrusted hook silently, and runs it once trusted from the TUI, since trust is kept in `config.toml` (observed); until then nothing asks, and ingest runs only from Claude Code or a report. Trust covers a hook's entry in `hooks.json` (command, timeout, `async`), not its script: an update that changes an entry needs trusting again, a change to the script alone does not | `/hooks` in the Codex TUI |
| Codex surfaces never asked | `codex exec`, the TUI in full-access mode (approval `never`), and the IDE extension and the desktop app on threads of their own (their `originator` is not `codex-tui`): their calls take a branch's declaration, or one made elsewhere for the session | declare the branch |
| A TUI thread resumed in the desktop app or the IDE extension | held there unless approvals are off, inferred from the source: a resume writes no new `session_meta`, so line 1 still reads `codex-tui`. The desktop app shows a block's reason (observed on its own thread); the IDE extension was not observed | - |
| A TUI thread resumed by `codex exec` with an auto-review approver (`--approve-for-me`, `approvals_reviewer = "auto_review"`) | not `bypassPermissions`, so its prompt would be held with nobody to see why. Not seen | - |
| A Codex `/clear` or fork | a new session with no carried task: asked again on an undeclared branch | declare the branch |
| Branch of a Codex call | the branch its session started on: a branch changed during the session is not seen | - |
| A person who only uses Codex | measured when `aidd telemetry ingest` or `report` runs, which the plugin does at a Claude Code or a trusted Codex session start | run a report |
| Codex cache writes | part of `input_tokens`, which `input` subtracts them from, as OpenAI's own formula does; billed only on GPT-5.6 and later. OpenAI has one write rate, so `cache_write_1h` is `null`. A cached read and write above `input_tokens` was never seen: its `input` would be below zero, which the ledger does not read as a record | - |
| Codex versions | per-call records ship from Codex CLI 0.153. An earlier version writes calls only as running totals (`token_count`), which are not read: a session it wrote counts nothing. Observed: 0.149 pre-releases to 0.163 | - |
| Codex calls written with no record | not counted. Off by default: background remote compaction, memory extraction, the Guardian scorer. Always: title generation, `codex exec --ephemeral` (no session file), realtime and voice conversations, failed, aborted or dropped-stream responses, and, before 0.163, a response cut short by its output limit | - |
| Codex cost fields not in the file | the service tier actually served, and audio or image token detail. The counts are tokens, not money | - |
| A Codex fork that copies its parent's records | the copies carry the parent's `response_id`, so the ledger takes each call once. Not seen | - |
| A Codex thread resumed from a history that holds no per-call records | only the calls written as `token_usage_record` count: what the thread consumed before them is in no record. Seen as a thread whose running total is already large on its first call | - |
| A Codex `.jsonl.zst` that does not decompress | not seen. The calls decoded before the bad frame are stored once, the ledger being keyed, but every run tries the file again and counts them again in its own figures, with one unrecognised shape | remove or repair the file |
| A Codex `.jsonl.zst` whose last line is unterminated | not seen: that line is never read, the file being read once | - |
| A Codex `.jsonl.zst` whose frame declares no content size, or that holds several frames | one compressed before Codex 0.152 may declare no size: it is read as `zlib` decompresses it, unchecked. Several frames were not seen: of several, `zlib` reads the first alone | - |
| `AIDD_TELEMETRY=0` | stops hooks too; a key turned off meanwhile is observed at the next run without it | - |
| Declaration keys edited by hand: every key including the stamp, `aiddTask` and `aiddDeclaredAt` alone (read as unstamped), or a stamp removed or emptied | the branch reads as declared: no reader can tell who wrote a git config key | - |
| Copy or rename of an unstamped (cli-v5.5.0) declaration | the new name inherits it | declare on the new name, or on the original to stamp it before copying or renaming |
| Calls on a name used before, after a copy, rename or recreation and before it is declared again | the earlier generation's declaration still answers in the report, while `status` and the gate say undeclared: a branch with no declaration takes no snapshot, so nothing marks the new generation. Only calls the gate did not hold (unattended runs, IDE extensions) can land there | declare right after reusing a name |
| Reflog entry of the rename or copy expired before B's first declaration | B's start is its oldest remaining entry; on a name used before, an older start can let the earlier B's declaration speak for later calls | declare soon after a rename or copy |
| Branch snapshots recorded before stamping (a copied branch, a hand-set task with a `declared_at`) | keep attributing: attribution reads snapshots, `branches.jsonl` is append-only | - |
| An ingest holding the ledger lock more than 10 minutes | another run clears the lock as stale while its holder still runs, and both write the ledger. An ingest was measured at 4.5 s for 250k records over 50 roots and 20.8 s for 1M over 200; one machine's whole history is about 267k usage lines | - |
| Records stored before reasoning and an advisor's one-hour write were read | keep `reasoning` and the advisor `cache_write_1h` at `null`: a transcript line already read is not read again | - |

## Never leaves the machine

Release 1 opens no network connection, in the telemetry context or the hooks. `forget --yes` removes everything.

- Local only: ledger `cwd` and `git_branch`, roots, process facts, transcripts.
- Text report: no path, branch, working directory or whole session id (short keys); envelope per [Report envelope](#report-envelope). `task`, `status`, `forget` print what they act on (a branch: `Branch feat/x is bound.`; `forget` lists entries and repositories); the lock error names the lock file.
- Identity only if chosen: `aidd telemetry identity <id>`, `on --as <id>`, or the answer to `on`'s question. Labels the `person` axis only; `on` and `status` name it.
- No currency amount: the destination owns the price table.

**Who is measured, at `on`.**

| Case | `on` does |
| --- | --- |
| identity set, no flag | keeps it, asks nothing |
| none set, a terminal | after the opt-in is confirmed, asks: git's `user.name` in that directory, else `user.email` (offered only when `personIdOf` accepts it, never under `AIDD_TELEMETRY=0`), another identifier typed, or anonymous |
| `--as <id>` | sets it, replacing one set; refused before anything is written when not one line of 1 to 128 characters |
| `--anonymous` | sets nothing; refused while an identity is set (`identity --off` first) |
| `--yes`, none set, no flag | refused, exit 1, nothing written |
| `--as` with `--anonymous` | refused, exit 1 |

A refused `on` writes neither consent nor identity. Staying anonymous is not stored: the next `on`, in any clone, asks again.
