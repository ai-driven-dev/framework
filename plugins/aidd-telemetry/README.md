← [aidd-framework](../../README.md)

# aidd-telemetry

Counts the tokens your Claude Code sessions consume, each model call once, by person, session, model, agent, day, repository, task and ticket. Release 1 measures Claude Code only, and sends nothing anywhere.

## Start

1. Install: `npm install -g @ai-driven-dev/cli`, then `aidd plugin install aidd-telemetry`. Its hooks need `node` on `PATH`.
2. In each clone to measure: `aidd telemetry on`. Nothing from before is counted.
3. Work. On a new branch, the first prompt asks for the task: send `aidd telemetry task <name> [--ticket <ref>]` as your next prompt.
4. Read it: `aidd telemetry report --axis task` (or `ticket`, `day`, `model`…).

## Commands

| Command | Does |
| --- | --- |
| `aidd telemetry on` / `off` | start or stop measuring this clone; what was measured stays |
| `aidd telemetry status` | whether this clone is measured, since when, and its task |
| `aidd telemetry task <name> [--ticket <ref>]` | declare the task; `--none` for no task |
| `aidd telemetry report [--axis <axis>] [--days <n>]` | what the work consumed, split along one axis; `--json` for the envelope |
| `aidd telemetry identity <id>` / `--off` | be named on your own measurement, or not |
| `aidd telemetry forget` / `--yes` | show what is kept, then erase it |

## When it asks

Once per working branch, never on the default branch or a detached `HEAD`, only in a measured clone.

| Where | Asked | Declare with |
| --- | --- | --- |
| Terminal, desktop app | yes | the command as your next prompt (it never reaches the model) |
| IDE extension (seen: VS Code) | no, it shows no hook message | the command in a terminal: binds the branch |
| Headless run | no | - |

- After `/clear` or `/branch`, the new session keeps the task.
- Work with no task is its own row, attributed once its branch is declared.

## What it measures

- Every billed call in Claude Code's session files: main thread, sub-agents, advisor.
- Four counters apart: input, output, cache read, cache write. Unknown is never zero.
- The task and ticket only from what you declare, never guessed.
- Tokens only, no currency.

## Privacy

- Consent is per clone: a git config key (never committed) plus an interval `on` opens. A pulled repository, a copy or a moved clone is not measured until `on` runs there.
- Data stays in `~/.config/aidd/telemetry` (or `AIDD_TELEMETRY_DIR`) and in the clone's git config.
- `AIDD_TELEMETRY=0` refuses measurement everywhere.
- Formats and rules: [usage contract](../../aidd_docs/product/usage-contract.md).

## Skills

| Skill | Use it to |
| --- | --- |
| `aidd-telemetry:00-init` | opt in after consent, stop, set or remove your identity, forget |
| `aidd-telemetry:01-usage` | ask what a period, a task or a ticket consumed |

## Hooks

Plain Node, Claude Code only, silent unless the clone is measured. Each also ends a clone's consent turned off by hand (`git config aidd.telemetry off`).

| Event | Does |
| --- | --- |
| `SessionStart` | records the session; after `/clear` or `/branch` keeps the task |
| `SessionStart`, async | reads new session files into the local ledger |
| `UserPromptSubmit` | asks once for a task; runs a typed declaration without the model |
