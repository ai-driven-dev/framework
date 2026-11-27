---
objective: "aidd-telemetry hooks follow the framework hook contract and never block the person: one reminder at session start on an undeclared working branch, one silent ingest."
status: pending
---

# Plan: Telemetry hooks under the hook contract

Source: user request in session, 2026-11-25: the hooks are too constraining and do not follow the current standard, blocking the user is extreme.

## Phases

| #   | Phase                         | File                         | Depends on |
| --- | ----------------------------- | ---------------------------- | ---------- |
| 1   | remind-instead-of-block       | [`phase-1.md`](./phase-1.md) | none       |
| 2   | ingest-under-the-contract     | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | docs-and-checks               | [`phase-3.md`](./phase-3.md) | 1, 2       |

## External sources

| URL  | What it settled |
| ---- | --------------- |
| none | none            |

## Impact

| Category      | Verdict and evidence | Handled in |
| ------------- | -------------------- | ---------- |
| runtime       | missing, blocking phase 1: `answer()` in `cli/assets/hooks-runtime/host-claude.cjs` returns early without `text`, and reads `person` only at Stop; `host-codex.cjs` has no `person` channel. Prerequisite owned by refacto-cli on its branch off `refactor/cli-target`: `answer({ level: 1, person })` without `text` prints the person channel at any event where the host has one (Claude: `systemMessage`), else nothing. Phase 1 merges that branch before its tests. Codex: no channel known, the reminder prints nothing there unless refacto-cli finds one in the vendor docs | 1 |
| runtime       | unverified: Codex runs a plugin hook only once trusted with `/hooks` (README); new commands likely need trusting again | 3 |
| regression    | high: `scripts/__tests__/aidd-telemetry-hooks.test.js` (1262 lines) pins the gate, the intercept and the carry, and line 717 pins the consent close by `session-start.cjs` and `catch-up.cjs`; `scripts/check-claude-tokens-end-to-end.cjs` `--attended` (lines 207-237) asserts the gate, a `hook-intercept` declaration and a carry; in `cli/`: `tests/fixtures/hooks-routes/*/`, `tests/contexts/telemetry/testing/consent-world.builder.ts:37` and `consent-scenarios-later.integration.test.ts:107,238` run `prompt-gate.cjs` (refacto-cli). No safety-net phase: the removed behaviour is removed on purpose | 1, 2, 3 |
| architecture  | telemetry hooks move from raw payloads and their own `hook-io.cjs` to `hooks/lib/host.cjs`, written by `scripts/check/engine/sync.cjs` into each plugin whose hooks require it; `docs/ARCHITECTURE.md:80` stops excluding aidd-telemetry | 1, 2, 3 |
| documentation | `docs/ARCHITECTURE.md` § Hooks, `aidd_docs/product/usage-contract.md` § Ask, § Carry, § Stores, § Consent, `plugins/aidd-telemetry/README.md`, `scripts/__tests__/fixtures/telemetry-bindings/README.md`; CLI memory `aidd_docs/memory/internal/cli/telemetry.md` left to refacto-cli | 3 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `docs/ARCHITECTURE.md` § Hooks rules 1 to 8 | the target contract: levels, moments, neutral interface, one entry per concern, built-ins, 5 s bound, status message |
| usage contract § Attribution: a late declaration moves a branch's earlier calls onto its task | why no prompt needs blocking: nothing is lost by declaring later |
| framework stays standalone without the CLI | the reminder only names the command; no hook needs `aidd` except the ingest, which stays silent without it |
| user, 2026-11-25: no prose, clean code, clean architecture, no needless comment, docs as lean as possible | every file this plan writes |
| no write in `cli/` from this branch | refacto-cli takes the adapters, the hooks-routes fixtures, the CLI tests that run `prompt-gate.cjs`, the old-data readers and the CLI memory |

## Decisions

| Decision | Why |
| -------- | --- |
| Never block a prompt; remind once per session start on an undeclared working branch | the user's call; it reverses "every prompt is held" of the deterministic-tokens spec, which wanted no token spent before a task |
| Drop the pid carry across `/clear` and fork | a branch declaration already survives it; accepted loss: a session-only declaration (default branch, detached HEAD) does not |
| Keep the async ingest as a stated exception to rules 5 and 6 | transcripts must be read before the host deletes them; it runs in the background and prints nothing |
