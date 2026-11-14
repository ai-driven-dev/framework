---
status: historical-in-progress-current-delivered-with-validation-limit
---

# Phase 2: Configuration-backed Kilo rules

Historical instruction: [original phase file in the archived worktree](https://github.com/ai-driven-dev/framework/commit/35edbdc02fd427b8ad6c53810dba38a536ccb691). Historical status: `in-progress`. Current scope status: Kilo rule publication delivered; the historical phase is not retroactively marked complete.

## Architecture projection

- Reuse the shared rule writer introduced by #979; do not add a competing publisher.
- Write Kilo rules under `.kilo/rules/<category>/<slug>.md` and register the exact path in the selected config's `instructions` array.
- Preserve unrelated JSON/JSONC content. Require explicit selection when existing config ownership is ambiguous; refuse unsupported path-scoped rules before writing.

Current implementation: `plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs`, `plugins/aidd-context/skills/05-rule-generate/scripts/kilo-config.cjs`, and `scripts/__tests__/kilo-rule-publication.test.js`.

## Test Scope

Config selection, JSON/JSONC preservation, idempotence, unsafe/ambiguous input refusal, and rollback on covered write failures. Current Kilo E2E inspects the rule's `instructions` registration with `kilo debug config`; it does not read the rule body. The archived [phase-2 report](https://github.com/ai-driven-dev/framework/blob/2f1aaadefe15342c5dcb0a1ca73a1846fd470c5c/aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/phase-2-report.md) records an older Kilo 7.8.8/Linux rule-consumption observation, but does not preserve the exact run SHA. It is not current-HEAD evidence.

## Tasks to do

- Historical: extend #979's shared writer and validate Kilo config-backed rules. The archived plan reports technical checks and a Linux runtime observation, but leaves the phase `in-progress` because it lacked authenticated Claude validation or a maintainer exception.
- Current: retain the Kilo behavior and safety checks; do not reopen unrelated writer work. No Claude-authenticated validation is claimed.

## Test acceptance criteria

| Criterion | Current evidence/status |
| --- | --- |
| A Kilo rule uses the canonical path and exact `instructions` entry. | Unit/contract and fixture tests; current CI green. |
| Ambiguous config is not chosen silently; unsafe config fails before mutation. | Rule publication tests cover these cases. |
| JSONC comments, order, duplicate entries and unrelated formatting are preserved. | Covered by writer tests. |
| Kilo configuration registers the rule path. | Current E2E checks the `instructions` path with `kilo debug config`; current CI does not prove Kilo reads the rule body. |
| Kilo reads the published rule body. | Historical 2026-10-12 Kilo 7.8.8/Linux report only; exact run SHA not preserved, so not attributed to current HEAD. |
| Repository host-testing convention is fully met. | Not demonstrated: no authenticated Claude Code validation is available. |
