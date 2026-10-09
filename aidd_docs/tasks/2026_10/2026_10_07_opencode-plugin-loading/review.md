# Review: OpenCode loading and Kilo lifecycle

- **Verdict**: approve within the runtime limits below
- **Diff**: `origin/next...fix/opencode-plugin-loading`, including the final repair
- **Axes run**: code, functional, relevancy; fresh reviewers received no prior verdict
- **Date**: 2026_10_08
- **Findings**: 0 critical, 0 warning, 0 minor remaining

## Phases

### Phase 1: OpenCode compatibility and delivery

- [x] Import starts no hook — `cli/tests/e2e/opencode-hooks-bridge-generated.e2e.test.ts`.
- [x] V1 invokes once; V2 setup returns promptly and cancels its stream — `scripts/__tests__/aidd-telemetry-opencode-payloads.test.js:60`, `scripts/__tests__/opencode-plugin.test.js:168` and released loader/SDK sources in [proof](./verification.md).
- [x] Malformed events, failed tools and repeated success stay safe — `scripts/__tests__/opencode-plugin.test.js:138,272`, generated-module regressions and [counterproof](./verification.md).
- [x] Coding and architecture gates pass — prior-head CI and fresh local checks below; final-head gates required before merge.
- [x] Real V2 loads both plugins and changes memory/journal — [observed effects](./verification.md).
- [x] Real V1 preserves effects without duplicate start — same proof, released host 1.18.29.
- [x] Verification distinguishes real-host effects, controlled regressions and substituted inference — same proof.

### Authorized extensions

- [x] Helper outside discovery, unique ownership and safe install/update repair — `cli/tests/contexts/framework/application/plugin/plugin-runtime-files.integration.test.ts:61,75,94,112,125`.
- [x] Kilo lifecycle, matchers, replay, new turns, deleted-session recreation and failure reporting — `cli/tests/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.unit.test.ts:33,96,203`.
- [x] Kilo JSONC preservation and real complete turn after shutdown — `cli/tests/contexts/framework/application/plugin/kilo-plugin-delivery.integration.test.ts:77,87,98`, `cli/tests/e2e/kilo-runtime.e2e.test.ts:192`.
- [x] Windows LF preservation and drift counterproof — `cli/tests/architecture/bundled-config-checkout.arch.test.ts:41,45`.
- [x] No unused addition or weakened gate identified — static review of 62 implementation/test/CI files; prior-head CLI CI passed all 29 jobs.
- [x] Architecture/docs match responsibilities; concise rule remains Claude-only; project memories untouched — complete diff checked for relevance and contradictions.
- [ ] Historical research → regression → implementation chronology — not reconstructed independently; not applicable to current-state review.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |

## Verification

| Metric | Value |
| --- | --- |
| Verified | Functional reviewer corroborated 22/23 checks (96%); historical chronology excluded from current-state verdict |
| Files checked | Entire PR diff; 62 implementation/test/CI files checked for code quality; documentation checked for relevance and contradictions |
| Resolved | Same-version update skipped helper repair: repair now precedes version comparison. Fixture depended on working directory: uses `REPOSITORY_ROOT`. Both fixes independently rechecked. |
| Regression | Missing-helper test failed before repair; 36 selected update/runtime tests then passed. |
| Built CLI | Isolated setup → install → delete helper → same-version update restored exact helper bytes; preserved configuration/plugin record and unique ownership. |
| Local checks | Changed-file Biome, diff whitespace and build passed within unchanged budget. |
| Merge gates | Required local hooks and [exact-head PR checks](https://github.com/ai-driven-dev/framework/pull/971/checks) must pass before merge. Prior head `144de007` passed all executed checks. |
| Unchecked | Historical chronology: not applicable. Temporary real OpenCode probes and limits documented in [proof](./verification.md). |
| Runtime limits | Inference substituted locally; paid providers, global profiles, hot reload and Windows Kilo runtime untested. Kilo telemetry unsupported. |
| Unplanned | None beyond user-authorized Kilo, verification and documentation extensions. |
