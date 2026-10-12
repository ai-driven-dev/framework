# Review: Assess existing rules before writing

- **Verdict**: changes-requested
- **Diff**: `3e67f6f594b7b7f6cc7bceb0581ad6d515519080...f75d450681e8c7e49ae21da005278782ab4c9ee2`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_12
- **Findings**: 0 critical, 1 warning, 0 minor
- **Score**: 90/100; six plan criteria and four baseline checklist items fulfilled, reduced for one material discovery gap in the actual need.

## Phases

### Phase 1 — Assess, resolve, then preserve publication

- [x] No create/update write without assessment and explicit decision on the complete candidate. — `plugins/aidd-context/skills/05-rule-generate/actions/02-assess-existing-rules.md:15`; `actions/03-write-rule.md:15`; baseline RED and twelve unchanged assessment snapshots in `receipts/baseline.json` and `receipts/native-assessment.json`.
- [x] Covered, overlap, conflict and needs-review findings cite sources; scope and canonical rendering exclusions are justified. — `actions/02-assess-existing-rules.md:16`; `references/tool-paths.md:44`; actual covered, overlap, edited-rendering, disjoint, uncertain and scope-uncertain answers and raw events in `receipts/native-assessment.json`.
- [x] Changed resolution is assessed again; keep and cancel leave project bytes unchanged. — `actions/02-assess-existing-rules.md:26`; revise/keep/cancel snapshots in `receipts/native-lifecycle.json`; merge reassessment and exact approved update in `receipts/native-merge.json`.
- [x] Publish/delete and five-host writer preserve existing behavior. — `SKILL.md:21`; `actions/01-capture-rule.md:16`; lifecycle publish/delete events and snapshots; `git diff BASE HEAD --exit-code -- plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs cli` exits 0.
- [x] Native receipts prove classifications and pre-decision no-write behavior, with honest limits. — `verification.md:7`; all twelve complete answers, fixture maps, raw-event SHA-256 values, on-disk snapshots and current fixture bytes checked; nine lifecycle and three merge answers match native JSONL events and prompts; `verification.md:43` discloses reference revisions and Codex-only skill execution.
- [x] Required gates pass; independent review has no critical blocking finding. — `/private/tmp/aidd-791-commit.log:4296` records 677 passed, 0 failed; `/private/tmp/aidd-791-push.log:129` records 7002 passed, 1 skipped; fresh architecture check reports seven governed files, no violation. The warning below requires repair before review clearance.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| warning | fit | 1 | `plugins/aidd-context/skills/05-rule-generate/references/tool-paths.md:34` | Claude discovery omits project `CLAUDE.local.md` and conditionally loaded `AGENTS.md` / `.claude/AGENTS.md`. A Claude-only candidate can miss an applicable conflicting policy in these files and be classified new. [Official memory documentation](https://code.claude.com/docs/en/memory#how-claudemd-files-load) includes local files at the working directory, ancestors and relevant descendants; [AGENTS discovery](https://code.claude.com/docs/en/memory#when-claude-code-reads-agentsmd) is conditional on version, enabled support and instruction-file mode. This leaves #791's relevant-policy comparison incomplete despite all supplied fixtures passing. | Extend this canonical discovery row with `CLAUDE.local.md` and conditional `AGENTS.md` / `.claude/AGENTS.md` sources. Apply documented activation; reuse line 40's needs-review handling when activation is relevant and unknown. Add a disposable Claude-only local-guidance assessment receipt proving conflict or justified needs review without writes. Keep writer and host precedence unchanged. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (6/6 plan acceptance criteria); one additional actual-need warning remains. |
| Files checked | All 19 changed files; root `AGENTS.md`, `docs/ARCHITECTURE.md`, project coding assertions/testing memory; review actions/template/rubric/validator; unchanged writer seam; six JSON receipts; all 24 native answers and prompts with raw JSONL; commit/push logs; official documentation linked in tool-paths. |
| Contract | [Issue #791 and comments](https://github.com/ai-driven-dev/framework/issues/791): four-action flow, semantic comparison, classifications, explicit resolution, source approval, disjoint-scope proof, verified rendering deduplication, unchanged publication. Claude discovery exception recorded above. |
| DRY | Fulfilled: host paths remain in tool-paths; assessment consumes that reference; catalogs are generated inventory. |
| Coherence | Fulfilled: router, renamed actions, R5 and catalogs agree; exact-body handoff and publish/delete bypass align; reference hash variants are disclosed. |
| Simplicity | Fulfilled: one assessment action, no CLI/writer changes or new abstraction; bounded project assessment excludes corpus audit #792. |
| Dead code / debug leftovers | Fulfilled: no unused shipped action, old action filename, debug output or silent TODO introduced. |
| Evidence integrity | Twelve fixture-content hashes equal recorded before maps; before/after maps equal native snapshots and current bytes; all twelve raw-event hashes match; final source hashes match source. Raw commands confirm read-only rendering verification and exact approved writer bodies; lifecycle deletion retains the documented empty AGENTS.md. |
| Validation | `git diff --check BASE HEAD` clean; unchanged writer/CLI diff exits 0; architecture guard checks seven files with no violation. Existing wrapped root suite and pre-push output inspected; full suite not redundantly rerun. |
| Limits | Model judgment is not a deterministic approval lock. Codex native skill runtime and five-host publication verified; native consumption by other hosts remains unproven and explicitly disclosed. Generic documented-import instruction already covers Claude imports; no additional finding. |
| Unchecked | none |
| Unplanned | none |
