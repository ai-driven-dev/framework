← [aidd-framework](../../README.md)

# aidd-telemetry

Understand token usage by skill and task to improve workflows.

> The previous measurement is removed and is being rebuilt, for Claude Code first. This plugin
> ships no skill until the replacement lands.

## Hooks

Plain Node, Claude Code only, silent unless the project opted in (`.aidd/config.json`, `telemetry.version: 2`).

| Hook | Does |
| --- | --- |
| `SessionStart` | records which session a Claude process is on; after `/clear` or `/branch` keeps the task |
| `SessionStart`, async | catches the ledger up with `aidd telemetry ingest --quiet` |
| `UserPromptSubmit` | answers a typed `aidd telemetry task ...` without the model, and asks once for a task on an unbound working branch when a person is present |

They need `aidd` on `PATH`; without it nothing is asked.

## Coverage

Restated when the rebuilt measurement lands.
