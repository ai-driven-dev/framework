# Envelope

What `aidd telemetry report --json` prints, and what each part means. Version `1`.

## Top level

| Field | Meaning |
| --- | --- |
| `version` | `1`. Any other value is a shape not known here |
| `refused` | Only present, with `version`, when measurement is refused by the environment; nothing was read |
| `period` | `from` and `to`, UTC days, `null` for open |
| `axis` | What `rows` split by |
| `rows` | One per value of the axis; every axis adds up to the same `totals` |
| `totals` | The whole period |
| `unknown_records` | Calls with at least one counter unknown |
| `coverage` | What the figures rest on |

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
| `files_read` | Session files read by this run |
| `records` | Calls recorded in the period |
| `unrecognised_shapes` | Lines of a shape the reader did not recognise, reported and never guessed |
| `not_stored` | Calls read and left out, by reason: `outside-repo`, `never-seen-alive`, `no-consent`, `consent-closed`, `unreadable-consent`, `no-cwd`, `undated` |
| `consent_log_damaged` | `true` while `ledger/consents.jsonl` cannot be trusted and nothing is stored |
| `oldest_transcript_at` | When the oldest session file still on disk was last written, `null` when there is none |
| `skipped_ledger_lines` | Stored lines that were not records |

## When there is nothing

| Sign | Likely reason |
| --- | --- |
| `records` of `0` and `not_stored.no-consent` above `0` | The clone has not opted in, or the calls were made before it did or while it was off: measurement starts at `aidd telemetry on` and reads nothing back |
| `not_stored.consent-closed` above `0` | The clone opted in once and its consent was closed: `aidd telemetry on` in that clone measures again, from then on |
| `not_stored.unreadable-consent` above `0` | A clone's git config or git directory cannot be read: nothing is stored for it until it can |
| `consent_log_damaged` is `true` | A line of the consent log `ledger/consents.jsonl` is not an event, so nothing is stored for any clone. Recovery is `aidd telemetry forget --yes`, then `aidd telemetry on` in each clone: nothing from before is stored. Do not edit the log by hand |
| `records` of `0` and `files_read` of `0` | No Claude Code session file is on disk for the period |
