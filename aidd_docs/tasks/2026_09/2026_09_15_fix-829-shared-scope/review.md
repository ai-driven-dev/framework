# Review: #829 shared user-scope plugin safety

- **Verdict**: blocked
- **Diff**: `origin/next...codex/fix-829-shared-scope` (staged candidate)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_15
- **Findings**: 3 critical, 1 warning, 0 minor

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
- [ ] Required mutation scopes are incomplete: `framework` scored 86.7% below 93% on the pre-remedy source tree; 13 scopes remain unrun — `cli/mutation-scopes.json:31`.

### Phase 4 — Preserve edited local integration

- [x] Edited Cursor hooks/scripts and OpenCode MCP contributions are kept; clean/remove only unedited A entries without touching B — `cli/src/contexts/framework/application/shared/remove-project-hooks.ts:79`, `cli/src/contexts/tools/domain/formats/opencode-mcp-merge.ts:1`.
- [x] Failed local cleanup preserves A's reference and blocks shared user clean — `cli/tests/contexts/framework/application/clean-use-case.unit.test.ts:796`.
- [x] Hook preflight precedes source-claim detachment and host changes — `cli/src/contexts/framework/application/clean-use-case.ts:204`.
- [x] Symlinked project integration outside the canonical root is refused without changing external bytes — `cli/tests/contexts/framework/application/shared/remove-project-hooks.unit.test.ts:62`.
- [ ] Targeted tests and full functional gates pass, but destructive mutation witnesses do not meet the required final scope floor — `cli/mutation-scopes.json:31`.

### Phase 5 — Guard user-scope files

- [x] Edited user plugin files survive update, remove, marketplace remove, and user clean; A's unedited contribution can still detach — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:257`, `cli/src/contexts/framework/application/ownership/user-plugin-file-updater.ts:112`.
- [x] A user-created new-path collision is refused before update overwrites it — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:279`.
- [x] A mixed native/file collision prevents host call, file writes, and claim movement — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:305`.
- [x] A substituted symlink is rechecked before file I/O; external bytes survive deterministic tested cases — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:332`.
- [x] Partial update failure retains truthful claims for manual reconciliation — `cli/tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts:380`.
- [ ] Targeted tests and integrated functional gates pass, but final mutation coverage remains below the required floor — `cli/mutation-scopes.json:31`.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| 🔴 critical | functional | 3 | `cli/mutation-scopes.json:31` | `framework` mutation 86.7% is below 93%; 13 other scopes are unrun and the report predates a wording-only source change. This draft is not merge-ready. | Add branch-distinguishing witnesses or simplify proof flow, then rerun every scope on one frozen source SHA. |
| 🟡 warning | functional | 3 | `cli/src/contexts/tools/domain/profiles/copilot/native-marketplace-source.ts:4` | Copilot 1.0.83 safely refuses even fresh native activation; #829's preservation need is met, but end-to-end Copilot install is partial. | Verify a structured source reader on a supported binary in a separate follow-up before claiming full support. |
| 🔴 critical | functional | 4 | `cli/mutation-scopes.json:31` | Destructive-hook guards have passing behavior tests but their required mutation witness is not certified by the below-floor framework report. | Strengthen targeted negative/positive tests, then repeat the full framework mutation gate. |
| 🔴 critical | functional | 5 | `cli/mutation-scopes.json:31` | User-file guards have passing behavior tests but their required mutation witness is not certified by the below-floor framework report. | Strengthen targeted negative/positive tests, then repeat the full framework mutation gate. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 78.9% (15/19) |
| Files checked | `cli/src/contexts/framework/application/{flows,clean,plugin,ownership,shared,uninstall}`, `cli/src/contexts/tools/{domain,infrastructure}`, relevant E2E/integration tests, `cli/scripts/smoke-collision.sh`, task plan and issue #829 |
| Unchecked | Phase 3 fresh Copilot — fix; Phase 3 mutation — fix; Phase 4 mutation — fix; Phase 5 mutation — fix |
| Unplanned | Measured bundle-budget increase and smoke harness adaptation support delivery verification; no unrelated feature found. |
| Draft disposition | User-authorized partial draft only; do not merge or close #829 until the strict gates and Copilot scope decision are resolved. |
