# Review: Five-host rule contracts

- **Verdict**: approve, bounded to local publication, captured loading/retrieval and reproduction safety
- **Score**: 100/100 for the five plan checks and four local review-baseline criteria; not a five-host native-enforcement score
- **Diff**: `303e17a1ba995dd19ec769381f7bbb594fbd1d7c` plus the scoped working-tree changes; `.hermes.md` and `.gitignore` excluded
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_11
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Contract verification

- [x] Compare all five formats, activation, scopes and session refresh with current official documentation — [official-contracts.md](official-contracts.md), independently checked official pages and pinned Codex source.
- [x] Repeat realistic installation, lifecycle, refusals, cleanup and guarded repository tests — [623 passing tests](evidence/root-tests.log), [five successful sandbox stages](evidence/sandbox/reproduction-results.json); independently rerun 69 relevant tests through `check-tests-leave-git-alone.js`, zero failures or skips.
- [x] Capture current native inputs through isolated profiles and loopback providers where supported, distinguishing loading from enforcement — [14 sessions/25 requests](evidence/runtime/checks.json), [Copilot 18 sessions/40 requests](evidence/copilot/audit.json), [Cursor refusal and coverage boundary](verification.md#cursor-current-quota-boundary).
- [x] Exercise global/scoped creation, exact replacement, deletion, fresh sessions, user-byte preservation and writer identity — [runtime candidate](evidence/runtime/candidate.json), [78 installed invocations](evidence/sandbox/lifecycle-results.json); independently counted captured markers and confirmed writer SHA-256 `70783e579b75b9e22760239cbfd4309641bdd73840b17e7dfd606a252679a420`.
- [x] Record current versions, independent review and remaining gaps without relabeling historical proofs — [verification.md](verification.md), [current Copilot receipts](evidence/copilot/cli-help-receipts.json); actual supplied binaries report Claude 2.1.295, Codex 0.162.1 and OpenCode 2.0.22.

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% of plan checks (5/5) and local baseline criteria (4/4); declared native/CI coverage boundaries remain below |
| Files checked | Scoped six-file tracked diff, new reproduction-file tests, both runtime harnesses, Copilot portable/baseline probes, Cursor probes/receipts, official-contracts.md, verification.md, 238 archived evidence files, 12 indexed source files, runtime request captures, security RED/GREEN/mutation artifacts, sandbox results, repository test log |
| DRY | Fulfilled: shared descriptor reader reused by ownership and both snapshot consumers; production writer remains canonical. Copied writers and historical harnesses are explicitly identified evidence snapshots. |
| Coherence | Fulfilled: native metadata matches current official contracts; Copilot baseline body checks remain 5/9, explicit retrieval 9/9; Cursor and remote CodeQL remain explicit gaps. |
| Simplicity | Fulfilled: no production writer change, dependency or generic glob parser; shared small helper closes the reported pathname races. |
| Dead code/debug | Fulfilled: unused names removed from the portable Copilot harness; no changed debug code or silent TODO observed. Historical baseline remains identified as frozen provenance. |
| Security | Descriptor opens use `O_NOFOLLOW`, validate `fstat`, read the same descriptor and close in `finally`. Independent FIFO test rejects promptly. Current Python ownership guard rejects FIFO before output creation in 0.072 seconds; [archived guard checks](evidence/harness-guards/checks.json) confirm FIFO refusal and both parent/child gone after process-group timeout. These checks do not establish resistance to every hostile ancestor-directory race or operating-system network confinement. |
| Cursor control | Independently confirmed `/private/tmp/aidd-oct11-cursor-native-FEFX3q/home` absent with no dangling symlink, without reading authentication. Archived AGENTS snapshots independently agree outside the owned memory block; whole-file equality is false (378 to 304 bytes), as the report states. Native consumer remains a quota refusal, not a loading pass. |
| Test witnesses | Initial ownership RED reads replacement instead of original. Three temporary mutations change exactly one helper line while keeping the test file identical: pathname read yields replacement bytes, missing close fails four `EBADF` checks, missing `O_NOFOLLOW` fails the symlink exception check. [Mutation results](evidence/security-mutations/results.json). |
| Proof integrity | Final frozen archive independently rehashed: 238 files / 2,518,542 bytes, exact manifest membership, zero mismatches. Nested Copilot 120 files, Cursor 25 files and source hashes 12 files also match exactly. All 145 evidence JSON files parse; all 11 archived repository gates exit zero. Final 14 runtime cases / 25 requests have zero marker errors. All local links in the three task reports resolve, and this report has exactly the three required sections. [Evidence index](evidence/index.json), [source identity](evidence/source-hashes.json), [repository gates](evidence/repository-gates.json). |
| Unchecked | No plan criterion tagged fix. Current Cursor native update/outside/delete and real-model semantic obedience are not established; Copilot automatic scoped full-body attachment is not established. [Remote CodeQL](https://github.com/ai-driven-dev/framework/runs/113740545599) independently confirms failure at `303e17a` with three high race alerts and seven notes; it has not rerun on these local corrections. These are declared coverage boundaries, not local passes. |
| Unplanned | Reproduction security repair follows the remote analyzer findings and belongs to repeatable verification. |
