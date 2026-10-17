# Envelope

What `aidd telemetry report --json` prints, and what each part means. Version `2`.

## Figures and run

Every field but `run` is a figure. The figures depend on these inputs and nothing else: the ledger's records, its left-out file, the declarations, the chosen identity, the period as resolved, the filters and the axis. Two reports with the same inputs print them byte for byte the same, whatever ingest ran before and in whatever order, run again or not, in any time zone or locale. `run`, always last, is what the read that printed the report found, and may differ from one report to the next.

A field may be added to version `2`: a figure outside `run`, a fact of the read inside it. A field is never renamed, retyped, moved or removed without a new `version`.

## Top level

| Field | Meaning |
| --- | --- |
| `version` | `2`. Any other value is a shape not known here |
| `refused` | Only present, with `version`, when measurement is refused by the environment; nothing was read |
| `period` | `from` and `to`, UTC days, `null` for open: resolved from the flags, `--days` against today's UTC day. The figures depend on these days, not on the flags |
| `axis` | What `rows` split by |
| `filters` | What the report was narrowed to: `task`, `ticket`, `person`, `model`, `agent`, `session`, `repository`, `absent`, `unattributed`. `null` when not given, else the value as resolved: a full id for a start or `.`, the axis for `absent`, the reason or `any` for `unattributed` |
| `rows` | One per value of the axis, of the calls the filters keep; every axis adds up to the same `totals` |
| `totals` | The calls of the period the filters keep; `totals.total.unknown_records` is how many had at least one counter unknown |
| `coverage` | What the figures rest on |
| `run` | What the read that printed the report found, last |

## A row and the totals

| Field | Meaning |
| --- | --- |
| `kind` | `value`, `unattributed` or `absent` |
| `key` | The value of the axis for a `value` row, else `null` |
| `reason` | Why there is no task for an `unattributed` row, else `null` |
| `records` | Calls in the row |
| `input`, `output`, `cache_read`, `cache_write` | `tokens` summed over the calls that reported it, and `unknown_records`, the calls that did not |
| `total` | The four counters added, with `unknown_records` counting calls with any counter unknown |

## Reasons and kinds

| Value | Meaning |
| --- | --- |
| `no-binding` | Nobody declared a task for this work |
| `declared-none` | A person declared that this work has no task |
| `absent` row | The axis has no value for those calls: no identity chosen, no model recorded, or no ticket given |

## Coverage

| Field | Meaning |
| --- | --- |
| `records` | Calls recorded in the period, whether the filters keep them or not |
| `left_out` | What every read so far, one at session start included, measured in a clone that consents and could not store: `undated` calls and `unrecognised` lines that are no usage line, each counted once in every report |

## Run

| Field | Meaning |
| --- | --- |
| `files_read` | Session files read by this run |
| `unrecognised_shapes` | Lines of a shape the reader did not recognise in this run, reported and never guessed |
| `not_stored` | Calls this run read and left out, by reason: `outside-repo`, `never-seen-alive`, `no-consent`, `consent-closed`, `unreadable-consent`, `no-cwd`, `undated` |
| `consent_log_damaged` | `true` while `ledger/consents.jsonl` cannot be trusted and nothing is stored |
| `oldest_transcript_at` | When the oldest session file still on disk was last written, `null` when there is none |
| `skipped_ledger_lines` | Lines that were not records, kept as found (a newer version may have written them), in the stored days this run read before tidying them: with a period, those days and the day on each side, plus every day of a month still kept in one file |

## When there is nothing

| Sign | Likely reason |
| --- | --- |
| `records` of `0` and `run.not_stored.no-consent` above `0` | The clone has not opted in, or the calls were made before it did or while it was off: measurement starts at `aidd telemetry on` and reads nothing back |
| `run.not_stored.consent-closed` above `0` | The clone opted in once and its consent was closed: `aidd telemetry on` in that clone measures again, from then on |
| `run.not_stored.unreadable-consent` above `0` | A clone's git config or git directory cannot be read: nothing is stored for it until it can. For a clone that had opted in, its calls are then stored, read again by the next run; for any other directory, they are not |
| `run.consent_log_damaged` is `true` | A line of the consent log `ledger/consents.jsonl` is not an event, so nothing is stored for any clone. Recovery is `aidd telemetry forget --yes`, then `aidd telemetry on` in each clone: nothing from before is stored. Do not edit the log by hand |
| `totals.records` of `0` and `coverage.records` above `0`, with a filter given | No call of the period matches the filters: a value no call has, or a start of a session or repository id that names none, printed as typed in `filters` |
| `records` of `0` and `run.files_read` of `0` | No clone on this machine has opted in, so no session file is read (`aidd telemetry status` says so in the clone); or no Claude Code session file was written since the first `aidd telemetry on` |
