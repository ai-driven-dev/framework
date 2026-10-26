---
status: done
---

# Plan: Codex asks for its task

Contract: `contract.md`. Each phase starts with its tests, run red first, the red run recorded in `evidence.md`.

## Phase 1: the guard and the gate

- The hooks tell the tool from the payload: Claude Code's guard unchanged, a Codex guard beside it, the shared fixture extended on both sides (H1).
- The Codex presence rule, reading the session file's first line up to a bound (H2).
- `session-start.cjs` does nothing for Codex; `catch-up.cjs` ingests for both.
- Acceptance: every H1 and H2 case red before, green after; the existing hook suite unchanged.

## Phase 2: the session a declaration binds

- The composition root reads `AIDD_TELEMETRY_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`; the Codex hook sets the first for the `aidd telemetry task` it runs.
- End to end over a synthetic Codex session file: declared in the session, report attributes its calls, sub-agents' included (H3).
- Acceptance: `check-claude-tokens-end-to-end.cjs` unchanged in both modes (H4).

## Phase 3: the translation and the docs

- The merged `.codex/hooks.json` route keeps `async` (and `timeout`) as the plugin route does (H5).
- Usage contract, plugin README, `00-init` and `01-usage` texts, `stop.md`'s "asked about" line: what Codex asks, where, trust, the limits.
- Acceptance: the repository gates green, then the real run below.

## Real run (final acceptance, done: see `evidence.md`, "Real run")

In an isolated `CODEX_HOME` holding a temporary copy of the maintainer's Codex credentials, deleted after:

1. [x] Install the built plugin with `aidd`, trust its hooks with `/hooks`.
2. [x] In a clone that opted in, on an undeclared working branch: the TUI holds a prompt and says why.
3. [x] Type the declaration: it binds, the next prompt goes through.
4. [x] `codex exec` in the same clone: never held.
5. [x] `aidd telemetry report`: the session's calls are on the declared task.
6. [x] Resume a TUI thread in the desktop app and observe whether the block reason shows. If it does not, the presence rule needs a stronger signal before the PR ships; the orchestrator decides after the run.
