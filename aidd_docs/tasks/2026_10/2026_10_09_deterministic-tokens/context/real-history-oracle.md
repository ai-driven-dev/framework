# Real-history oracle

One manual run, on 2026-10-09, comparing what the built CLI counts on a real Claude Code history
with an independent count of the same files. Only counts are kept here: no session id, prompt,
path or token volume of the person whose history it was.

## Method

1. **Projection.** Every `.jsonl` under the real Claude `projects/` directory was read, never
   written. Each `assistant` line was copied into a sandbox `CLAUDE_CONFIG_DIR`, with its message
   content emptied and its `cwd` rewritten to one sandbox git repository opted in with
   `telemetry: {enabled: true, version: 2}`. Lines of other types were dropped. The counters, ids,
   timestamps and `iterations` were kept as they were.
2. **CLI.** The built `cli/dist/cli.js` ran `aidd telemetry report --axis day --json` from that
   repository. `HOME`, `CLAUDE_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `AIDD_USER_CONFIG_DIR` and
   `XDG_CONFIG_HOME` all pointed into the sandbox, and `CLAUDE_CODE_SESSION_ID` was unset.
3. **Independent count.** The `claude()` reader of [`prototype/check.py`](./prototype/check.py)
   (Python, written before the CLI) read the same files. Its records were grouped by the UTC day
   of `at`, and each day's four counters and record count were compared with the CLI's row.

The rewrite of `cwd` means this run checks counting, not attribution. Attribution is covered by
the e2e journey on synthetic transcripts.

## Result

| Measure | Value |
| ------- | ----- |
| Transcript files read | 2,746 |
| Records, CLI and independent count | 262,328 each |
| Days compared | 68 |
| Days differing on any counter or on the record count | 0 |
| Records with an unknown counter | 0 |
| Unrecognised shapes, lines not stored | 0, 0 |

Both sides sum cache writes over `iterations[type=message]`. That sum is the rule the previous
reference tool lacked, which is why it under-counted cache writes. Agreement here therefore proves
that two implementations of the contract agree. It does not prove that the contract matches
billing.

`oldest_transcript_at` in that run reflects when the sandbox copy was made, not the original
history, so it is not reported.
