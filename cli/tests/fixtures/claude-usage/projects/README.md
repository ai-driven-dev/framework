# Claude Code usage fixtures

Claude Code session journals read by the telemetry tests, under `projects/<project>/`. Each line carries the `version` of the host that wrote it.

## Host versions observed

| Version | Files |
| --- | --- |
| `2.1.290` | `projects/proj-a/s-0.jsonl.superseded-1` |
| `2.1.292` | `projects/proj-a/s-1.jsonl`, `projects/proj-a/s-1/subagents/agent-x.jsonl`, `projects/proj-a/s-2.jsonl` |

`claude-journal-versions.integration.test.ts` reads each version above and fails on any line left unrecognised.

## Layout

The files are not split by version: the tests read `projects/` as one tree, and a file moved would change what they see. A new observed version is added as its own file under `projects/`, and a row above.
