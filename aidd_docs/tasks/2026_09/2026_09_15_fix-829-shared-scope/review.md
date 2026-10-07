# Review: #829 shared user-scope plugin safety

- **Verdict**: blocked
- **Diff**: `origin/next...codex/fix-829-shared-scope`; mutation hardening published in `58b5e92b`, CI corrections under verification
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_17
- **Findings**: 1 critical, 2 warnings, 0 minor

## Phases

### Phase 1 — Guard native activation

- [x] Sync preserves foreign catalogue source, plugin ref, and cache bytes; refresh targets only proven AIDD catalogues — `cli/src/contexts/framework/application/flows/marketplace-sync-settings-use-case.ts:775`, `cli/scripts/smoke-collision.sh:69`.

### Phase 2 — Finish project-local removal

- [x] Marketplace removal and plugin uninstall clean A's local integration before detachment, retaining claims on local failure and leaving B/machine files intact — `cli/src/contexts/framework/application/flows/marketplace-remove-use-case.ts:106`, `cli/src/contexts/framework/application/uninstall/uninstall-plugin-use-case.ts:72`.

### Phase 3 — Prove current host source

- [ ] Fresh native registration across A/B is partial: Codex has structured source proof, but Copilot 1.0.83 cannot activate even on a new profile — `cli/src/contexts/tools/domain/profiles/copilot/native-marketplace-source.ts:4`.
- [x] Copilot refusal leaves foreign repository settings and native state untouched — `cli/scripts/smoke-collision.sh:81`.
- [x] Native readers use verified structured shapes and refuse unsupported outputs — `cli/src/contexts/tools/infrastructure/native-marketplace-source-reader-adapter.ts:45`.
- [x] User clean rejects orphan/unclaimed machine-global refs and project clean leaves another user's ref enabled — `cli/src/contexts/framework/application/clean/clean-user-scope-use-case.ts:316`, `cli/src/contexts/framework/application/clean-use-case.ts:248`.
- [x] Multi-tool user clean checks required binary availability before the first host mutation — `cli/tests/contexts/framework/application/clean/clean-user-scope-use-case.integration.test.ts:1158`.
- [ ] Final-head CI remains pending. Local `framework` passed at 93.5837%; the preceding published head passed twelve other mutation scopes in CI, but `tools-codex` failed at 90% against its 94% floor — `cli/mutation-scopes.json`.

### Phase 4 — Preserve edited local integration

- [x] Edited Cursor hooks/scripts and OpenCode MCP contributions are kept; clean/remove only unedited A entries without touching B — `cli/src/contexts/framework/application/shared/remove-project-hooks.ts:79`, `cli/src/contexts/tools/domain/formats/opencode-mcp-merge.ts:1`.
- [x] Failed local cleanup preserves A's reference and blocks shared user clean — `cli/tests/contexts/framework/application/clean-use-case.unit.test.ts:796`.
- [x] Hook preflight precedes source-claim detachment and host changes — `cli/src/contexts/framework/application/clean-use-case.ts:204`.
- [x] Symlinked project integration outside the canonical root is refused without changing external bytes — `cli/tests/contexts/framework/application/shared/remove-project-hooks.unit.test.ts:62`.
- [x] Targeted behavior tests, full functional gates, and the whole-framework mutation floor pass at 93.5837% — `cli/reports/mutation/framework/mutation.json`.

### Phase 5 — Guard user-scope files

- [x] Edited user plugin files survive update, remove, marketplace remove, and user clean; A's unedited contribution can still detach — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:257`, `cli/src/contexts/framework/application/ownership/user-plugin-file-updater.ts:112`.
- [x] A user-created new-path collision is refused before update overwrites it — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:279`.
- [x] A mixed native/file collision prevents host call, file writes, and claim movement — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:305`.
- [x] A substituted symlink is rechecked before file I/O; external bytes survive deterministic tested cases — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:332`.
- [x] Partial update failure retains truthful claims for manual reconciliation — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:380`.
- [x] Targeted behavior tests, integrated functional gates, and the whole-framework mutation floor pass at 93.5837% — `cli/reports/mutation/framework/mutation.json`.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| 🔴 critical | functional | 3 | `cli/mutation-scopes.json` | Framework hardening is published in `58b5e92b`, with a local 93.5837% result and matching source. The preceding head passed twelve other mutation scopes in CI; Codex, Smoke, and Windows failed. Final-head gates are not yet certified. | Correct the failing contracts and verify CI on the final published head before a merge-ready verdict. |
| 🟡 warning | functional | 3 | `cli/src/contexts/tools/domain/profiles/copilot/native-marketplace-source.ts:4` | Copilot 1.0.83 safely refuses even fresh native activation; #829's preservation need is met, but end-to-end Copilot install is partial. | Verify a structured source reader on a supported binary in a separate follow-up before claiming full support. |
| 🟡 warning | functional | 5 | `cli/src/contexts/framework/application/plugin/plugin-helpers.ts:58` | User clean validates paths with an injected home, but deletion resolves OS home. Normal OS-home deletion passes; custom injected-home deletion is not certified. | Align validation and deletion home resolution in a bounded follow-up with a custom-home witness. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 89.5% (17/19) |
| Files checked | `cli/src/contexts/framework/application/{flows,clean,plugin,ownership,shared,uninstall}`, `cli/src/contexts/tools/{domain,infrastructure}`, relevant E2E/integration tests, `cli/scripts/smoke-collision.sh`, task plan and issue #829 |
| Unchecked | Phase 3 fresh Copilot — follow-up; final-head CI, including Codex mutation, Smoke, and Windows — verification pending. Twelve other mutation scopes passed on the preceding head, not a fresh certification of the final tree. Custom-home cleanup is a separate diagnostic finding. |
| Unplanned | Measured bundle-budget increase and smoke harness adaptation support delivery verification; no unrelated feature found. |
| Draft disposition | User-authorized partial draft only; do not merge or close #829 until the strict gates and Copilot scope decision are resolved. |

## Incremental local test hardening — 2026_09_16

- Tests only: 236 additional cases since the 6,464-test snapshot; production source is unchanged during these lots. No commit or push.
- Latest functional run: `pnpm exec vitest run --reporter=dot` passed 524 files / 6,700 tests in 35.16s. Coverage was last measured before the 143 latest tests: 99.09% lines, 96.80% branches, 99.68% functions, with 6,557 tests passing in 74.95s. `pnpm typecheck`, `pnpm lint`, and `git diff --check` passed; lint retains only the existing unused constructor-property warning at `uninstall-use-case.ts:33`.
- Twenty-one targeted reports under `cli/reports/mutation/829-*/mutation.json` show 465 unique additional detections against the original baseline, without double counting overlapping campaigns. The original full report and incremental state are preserved under `cli/reports/mutation/framework-baseline-829/`; the preceding 90.0595% snapshot is preserved under `cli/reports/mutation/framework-90-before93/`.
- The final whole-framework incremental run used the existing runner's exported scope arguments, pruning, scoring, and floor check, with concurrency limited to two. It reused 5,954 results, replayed 2,275 mutants, and finished in 9m01s: 7,688 killed, 13 timed out, 465 survived, 63 uncovered; score 93.5836675173168% on 8,229 mutants. The declared 93% gate passed. All 115 reported source files match the frozen working tree; production source, mutation configuration, exclusions, and scripts were unchanged during hardening.
- Exact comparison with the original baseline gives 563 additional detections and no detection regression. Two unmatched mutation keys concern the previously documented sync warning wording. Against the preceding 90.0595% snapshot, 291 newly detected mutants and one detection loss give a net gain of 290. The retained loss is a static empty-string mutant in `plugin-distribution-reader-adapter.ts:20`; it was also undetected in the original baseline. Its status is not replaced with an earlier favorable result. The framework gate is passed, but the strict overall delivery verdict remains blocked by the other thirteen scopes and the documented partial Copilot verification.
- Covered additions: post-add source/root/type mismatches and unreadable proof, local alias versus host identity, project versus machine catalogue proof, exact attachment to an already-enabled machine ref while preserving B, exclusive-access update preflight, affected-project warnings, and original I/O error causes.

## Publication and CI corrections — 2026_09_17

- User-authorized publication: `58b5e92b` and `3946be7f` pushed to PR #870 with hooks active. Pre-commit architecture and lint, commitlint, and pre-push Knip and the full functional suite passed. The latest suite passed 525 files / 6,726 tests. The PR remains draft; no merge or issue closure.
- Windows reproduction: the file doubles registered `/project/link`, while callers used a resolved drive-qualified path. Two isolated Windows-path regression tests failed before correction. Symlink and `realpath` fault keys now resolve paths consistently; file-content keys remain unchanged. The focused four-file run passed 57 tests, including external-symlink refusal and project-boundary cases.
- Smoke now selects the native refusal contract only when Copilot is available; without it, local removal must succeed and warn that the native CLI is unavailable, followed by local reinstall. Both available-host and missing-host runs passed all 33 command families with zero failures. The native refusal run preserved exact project/home bytes.
- The previous Codex report matched its six source files but omitted the new native marketplace source parser, so its 96.8504% was not a current whole-scope certificate. Added malformed listing/source, mixed-row rejection, and actionable diagnostic witnesses through the public source reader; its 31 integration tests pass. The first fresh complete Codex run passed at 94.1176% on 459 mutants (430 killed, two timed out, 27 survived), covering all seven matching source files. A final run including four added diagnostic cases is under verification, with the 94% floor unchanged.
- Codex consolidation: the diagnostic cases reduce survivors to 21. A high-concurrency run overlapping the full suite reported 11 timeouts; it is not used as evidence of stability. A subsequent complete-scope run at concurrency two passed at 95.4248366% in 4m02s, with zero timeouts and the 94% floor unchanged.
- CI on `3946be7f` confirms Smoke passes, but Windows reports 37 failures because resolving every virtual `realpath` identity changed seeded project-reference identities. Two Windows-model tests reproduce the regression. The correction resolves symlink lookup keys while preserving unlinked paths and declared target identities; no production behavior or refusal assertion is relaxed. Final-head Windows verification remains pending.
- CI on `95497fee` confirms the external-symlink refusals and project-reference identity cases pass. Three Windows failures remain in assertions introduced by the mutation hardening: two cache-warning expectations hardcode POSIX separators, and a cache-neighbor list expectation ignores the double's slash-normalized keys. Expected diagnostics now use platform `join`; the neighbor-list expectation uses the documented normalization while retaining exact path and byte-preservation assertions. Final-head CI remains pending.
- Runtime bottleneck: in the final run Stryker estimated that 91 static mutants (4% of mutants scheduled for replay) would account for 61% of execution time. None were ignored. Harness optimization must preserve their witness coverage and sound cache invalidation.
- Marketplace-removal additions cover reserved shared-catalogue refusal before registry access, exact user-catalogue selection among competing entries, exact native scope and host name, implicit host ref scope, a proven empty catalogue without plugin claims, missing canonical ledger, and project cleanup without a native mapping or orphan. The two targeted campaigns took 17s and 21s; the final report contains 202 killed / 10 survived across 212 mutants. The surviving empty file-scope literal still resolves to the same user directory; no invalid runtime scope was introduced just to distinguish it.
- Synchronization additions in `cli/tests/contexts/framework/application/flows/marketplace-sync-settings-scope.integration.test.ts` and `marketplace-sync-source-provenance.integration.test.ts` cover implicit/explicit project synchronization inside the machine lock, user-scope non-reentrancy, lock failure before project reads or host writes, missing/unreadable plugin registries with and without a diagnostic, explicitly absent plugin registries followed by post-add source proof, and Claude catalogue absence versus late unreadability or a newly appearing same-name foreign catalogue. The two targeted campaigns took 50s and 53s; the latest report contains 96 killed / 16 survived / 0 uncovered across 112 mutants. Their overlapping gains were counted once.
- Late-refusal/projection additions in `cli/tests/contexts/framework/application/flows/marketplace-sync-native-provenance.integration.test.ts` cover a transient source-read refusal followed by recovered proof, foreign/missing source, foreign refs or unreadable refs, for Codex and the future-supported Copilot test double. Existing project references and B's machine claims survive invalid proof; recovered proof attaches only this project. Narrowed sync drops obsolete target references only after valid proof and retains references when another alias still owns the same host catalogue. The Claude late-collision test also explicitly asserts an empty project projection. `829-sync-late-refusal-projections/mutation.json` matches current source: 130 killed / 17 survived / 1 uncovered across 148 mutants, in 44s; 19 detections beyond the complete snapshot, of which two overlap the preceding registry-proof lot, so the net addition is 17. No claim of real Copilot support follows from these doubles.
- Catalogue-versus-plugin additions in `cli/tests/contexts/framework/application/flows/marketplace-sync-source-provenance.integration.test.ts` cover project/user Claude catalogue refusal without phantom machine claims, a catalogue containing an undeclared plugin without enabling or claiming that plugin, scope-specific machine catalogue ownership for Claude/Codex, idempotent ownership saves, preservation of B's existing claims and tool version, another alias pointing at the same host, and fresh machine tool/version initialization. `829-sync-catalogue-plugin-claims/mutation.json` matches current source: 109 killed / 13 survived / 0 uncovered across 122 mutants, in 41s; 14 detections beyond the complete snapshot, of which five overlap preceding lots, so the net addition is nine.
- The first threshold-93 batch, `829-threshold93-native-recovery/mutation.json`, measured 152 novel detections beyond every preceding targeted lot: clean 39, sync 32, plugin removal 27, hooks 28, plugin add 7, init 7, native registration gate 7, file updater 5. It completed in 2m58s across 1,034 mutants. Fourteen formerly detected mutations survived in this narrower run; these discrepancies are retained for the whole-framework replay, not omitted from the verdict. Added witnesses assert preflight state preservation, native cache retention on binary loss, exact host diagnostics, recovery races and scope, public upgrade/no-op behavior, and hook contribution ownership. The test skill's behavioral contract ruled out contrived invalid inputs for unreachable branches.
- Separate diagnostic finding: `CleanUserScopeUseCase` checks user files with its injected home directory, but `deletePluginFilesForTool` resolves deletion through OS `nodeHomedir` (`cli/src/contexts/framework/application/plugin/plugin-helpers.ts:58`). The truthful OS-home test proves normal user-file deletion; it does not certify custom injected-home deletion. No production workaround was added to raise the mutation score.
- The final targeted batch, `829-threshold93-final-contracts/mutation.json`, added another 61 novel detections: user clean 21, sync 17, native source proof 5, cache purge 6, built materialization 3, runtime settings 3, plugin removal 2, tool uninstall 4. It completed in 1m45s across 508 mutants. All narrow-run discrepancies were left for the complete replay; the reported final global score, not the sum or average of targeted scores, is the certified result.
- Threshold-93 objective complete. Remaining delivery work: verification of the other thirteen scope gates and the existing Copilot follow-up; custom-home cleanup is separately documented. No legacy migration, commit, or push was performed.
