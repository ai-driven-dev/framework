---
objective: "Every billed Claude Code call is counted once, stored locally, and broken down by person, session, model, period, repository, task and ticket, the task coming only from a declaration, with the previous telemetry gone."
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Deterministic token measurement, release 1

## Overview

| Field      | Value                                                     |
| ---------- | --------------------------------------------------------- |
| **Goal**   | Replace the previous telemetry with a deterministic, declaration-attributed token count for Claude Code |
| **Source** | [`spec.md`](./spec.md), with [`context/target.md`](./context/target.md) and [`context/usage-record-contract.md`](./context/usage-record-contract.md) |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Remove the previous telemetry from the CLI         | [`phase-1.md`](./phase-1.md) |
| 2   | Remove it from the plugins, scripts, CI and docs   | [`phase-2.md`](./phase-2.md) |
| 3   | Count: Claude transcripts to usage records         | [`phase-3.md`](./phase-3.md) |
| 4   | Store: the ledger, ingest, consent                 | [`phase-4.md`](./phase-4.md) |
| 5   | Declare: the task command and its stores           | [`phase-5.md`](./phase-5.md) |
| 6   | Ask: the plugin hooks                              | [`phase-6.md`](./phase-6.md) |
| 7   | Attribute and report                               | [`phase-7.md`](./phase-7.md) |
| 8   | Opt in, opt out, forget, and what V1 left behind   | [`phase-8.md`](./phase-8.md) |
| 9   | Skills, docs, and the end-to-end proof             | [`phase-9.md`](./phase-9.md) |

Phases 1 and 2 land as their own commits but never ship alone: the branch merges only once
phase 9 is green, so `next` never carries a CLI without measurement.

## Resources

| Source | Verified |
| ------ | -------- |
| https://code.claude.com/docs/en/hooks | `UserPromptSubmit` blocks before the model; a blocked prompt's message ends with `Original prompt:` and is written to the transcript unless `hookSpecificOutput.suppressOriginalPrompt` is true; it also fires on turns Claude starts on its own, with no field telling them apart; `async: true` cannot block and its `systemMessage`/`additionalContext` go to the model on the next turn; `-p` kills a running async hook at teardown; `SessionStart.source` is `startup \| resume \| clear \| compact \| fork` |
| https://code.claude.com/docs/en/env-vars | `CLAUDE_CODE_SESSION_ID` is set in hooks and Bash tool subprocesses, matches the hook's `session_id`, and is updated on `/clear`. `CLAUDE_CODE_ENTRYPOINT` and `CLAUDE_CODE_SESSION_ATTENDED` are not documented |
| https://learn.chatgpt.com/docs/hooks | Codex `UserPromptSubmit` can block (`decision: block` or exit 2): Codex delivers the same event name, so the hook must refuse non-Claude hosts itself |
| Sandbox probes, Claude Code 2.1.295 ([`context/target.md`](./context/target.md)) | `ATTENDED=1`/`ENTRYPOINT=cli` interactive, `ATTENDED=0`/`sdk-cli` under `-p`; `CLAUDE_CODE_CHILD_SESSION=1` in both; `!` commands see the session id and fire no `UserPromptSubmit`; `/clear` changes the session id, keeps `CLAUDE_PID`, carries no previous id; a hook `systemMessage` shows as `SessionStart:clear says: …`; a blocked `-p` exits 0; a commit hook line naming a missing script fails the commit |

## Decisions

| Decision | Why |
| -------- | --- |
| The CLI owns reading, storing, attributing and reporting; the plugin hooks only ask, intercept the answer, and record session facts | One implementation per concern. The hook runs on every prompt, so it stays plain node with no `aidd` spawn on the common path (61 ms against 241 ms measured for V1) |
| The declaration command is `aidd telemetry task <name> [--ticket <ref>] \| --none` | The task exists only for measurement; it lives under the measurement command group, not as a new top-level verb |
| A branch declaration is stored in the repository's own git config (`branch.<name>.aiddTask`, `aiddTicket`, `aiddDeclaredAt`); session declarations and `/clear` carries are stored in the person's telemetry directory | git config follows a branch rename and dies with the branch, and it needs no file in the work tree; a session is per person and machine |
| The hook acts only when the payload's `session_id` equals `CLAUDE_CODE_SESSION_ID` and the payload is Claude-shaped | Codex and Copilot deliver `UserPromptSubmit` under the same name, and a Codex nested in Claude inherits Claude's variable: equality makes the hook inert elsewhere by construction |
| Block only when `CLAUDE_CODE_SESSION_ATTENDED=1` and `CLAUDE_CODE_ENTRYPOINT` does not start with `sdk`; anything else never blocks | Both variables are undocumented; requiring both to agree, and failing open, means a change in Claude can only stop the asking, never block work wrongly |
| The format the CLI writes and the hook reads (bindings, carries) is pinned by one shared fixture under `scripts/__tests__/fixtures/telemetry-bindings/`, read by a CLI test and a hook test | Two languages, one format: the fixture is the contract, so neither side can drift silently |
| Ledger under `<telemetry dir>/ledger/`, where the telemetry dir is `AIDD_TELEMETRY_DIR`, else `userConfigDir()/telemetry` | A subdirectory keeps it apart from V1's day files at the root, which `forget` removes; `userConfigDir()` honours `AIDD_USER_CONFIG_DIR`, which V1's identity did not |
| Consent is `telemetry.enabled: true` with `telemetry.version: 2`; the previous version's bare `enabled: true` is ignored | Nobody is asked or measured by the new version without having opted in to it; `on` also cleans what the previous version left |
| Skills in other plugins never call the telemetry command in release 1 | A plugin must not depend on the telemetry plugin; the hook's ask covers every case. A skill-side pre-emption is a follow-up |
