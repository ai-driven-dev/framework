← [aidd-framework](../../README.md)

# aidd-telemetry

Counts the tokens your Claude Code sessions consume, each model call once, and breaks them down by person, session, model, day, repository, task and ticket. Claude Code is the only tool measured in release 1.

## What it measures

- Every billed model call, read from Claude Code's own session files: the main thread, sub-agents and advisor calls.
- Four counters, always apart: input, output, cache read and cache write.
- A value a call does not report is unknown, never zero, and a report says how many calls it concerns.
- Tokens only. No amount in currency is computed.

The task and the ticket come only from what you declare. Nothing guesses them from a branch name, a folder, a commit or a prompt.

## What it asks, and when

Once per working branch, before the work starts: a task name, an optional ticket.

| Where | Asked | Declare with |
| --- | --- | --- |
| Terminal, desktop app | yes | `aidd telemetry task <name> [--ticket <ref>]` as a prompt (never reaches the model); terminal: also `! aidd …` |
| IDE extension (seen: VS Code) | no, it shows no hook message | the same command in a terminal: binds the branch |
| Headless run | no | - |

No task: `aidd telemetry task --none`.

Never asked:

- default branch or detached `HEAD`;
- clone not measured: run `aidd telemetry on` in it first. A pulled repository, a copy, a moved clone or a hand-set key is not measured.

After `/clear` or `/branch` the new session keeps the task and tells you so. Declaring a task there replaces it for the whole session. Work with no task is a row of its own, and is attributed afterwards once its branch is declared.

## What stays local

Release 1 sends nothing anywhere. Measurement lives in one directory on your machine, `~/.config/aidd/telemetry` unless `AIDD_TELEMETRY_DIR`, `AIDD_USER_CONFIG_DIR` or `XDG_CONFIG_HOME` moves it, and in your repository's own git config for branch declarations and the clone's consent key. `aidd telemetry forget` shows what is kept, and `aidd telemetry forget --yes` removes it. The formats are in the [usage contract](../../aidd_docs/product/usage-contract.md).

A person is named only if they choose to be, with `aidd telemetry identity <id>`.

## What it needs

| Part | Needs |
| --- | --- |
| Asking for the task and recording sessions | the plugin installed, and `node` on `PATH` |
| Counting tokens, reporting, opting in and forgetting | the `aidd` CLI (`@ai-driven-dev/cli`) |

Without `aidd` nothing is asked and nothing is counted. Measurement starts at `aidd telemetry on`: what a clone's sessions did before it is not counted, and `on` reads nothing back. After that, each run reads the session files Claude Code holds, and counts the calls made while the clone was on. A project is measured only after `aidd telemetry on` in it, and `AIDD_TELEMETRY=0` refuses measurement everywhere.

## Skills

| Skill | Use it to |
| --- | --- |
| `aidd-telemetry:00-init` | opt in after consent, stop, set or remove your identity, forget |
| `aidd-telemetry:01-usage` | ask what a period, a task or a ticket consumed |

## Hooks

Plain Node, Claude Code only, silent unless the project is measured. They also end a clone's consent when its key was turned off by hand (a `git config aidd.telemetry off`), by closing its interval in `consents.jsonl`, so the next prompt's calls are not counted.

| Event | Does |
| --- | --- |
| `SessionStart` | records which session a Claude process is on; after `/clear` or `/branch` keeps the task |
| `SessionStart`, async | reads new session files into the ledger |
| `UserPromptSubmit` | answers a typed declaration without the model, and asks once for a task when a person is present |
