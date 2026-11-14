# Verification record

Current source revision: [`f05904eff0733a37f822aa24d85c380edccbc42f`](https://github.com/ai-driven-dev/framework/commit/f05904eff0733a37f822aa24d85c380edccbc42f), published 2026-11-11. The four linked workflow runs completed successfully for this SHA:

| Workflow | Result |
| --- | --- |
| [cli CI](https://github.com/ai-driven-dev/framework/actions/runs/43083521376) | Success |
| [CI](https://github.com/ai-driven-dev/framework/actions/runs/43083521338) | Success |
| [Validate](https://github.com/ai-driven-dev/framework/actions/runs/43083521162) | Success |
| [CodeQL](https://github.com/ai-driven-dev/framework/actions/runs/43083521124) | Success |

## Reported results

- CLI suite: 7,380 passed, 5 skipped.
- Native Kilo E2E: passed on Windows, Linux, and macOS Intel; the Windows job reports 4/4 native E2E cases.
- Windows CLI passed; no `EBUSY` failure was reported.
- Coverage, mutation partitions, and final CLI gate passed.

## Issue acceptance criteria

The [issue](https://github.com/ai-driven-dev/framework/issues/914) defines 16 criteria. The current [PR description](https://github.com/ai-driven-dev/framework/pull/992) also records its partial-coverage notes. This index distinguishes those notes from the test evidence inspected here. `Partial` means the implementation contract has some evidence, but the evidence does not prove every part of the issue wording.

| AC | Current evidence and status |
| --- | --- |
| 1 | Contract assertions and detection fixtures cover signals; end-to-end coverage of onboarding and every applicable generation workflow remains partial. |
| 2 | Detection fixture cases cover canonical root/nested JSON/JSONC and directory signals, plus the legacy marker; no single runtime scenario exercises every detector. |
| 3 | Legacy rule publication is tested to emit canonical `.kilo/rules/`; equivalent end-to-end legacy-source coverage for all generators is partial. |
| 4 | Detection fixtures reject `AGENTS.md`-only and OpenCode-only projects. |
| 5 | Memory routing and preservation are covered by memory sync tests and Kilo fixtures; genuine LLM onboarding decisions are not evaluated. |
| 6 | Rule publication tests cover canonical `.kilo/rules/` output and the exact `instructions` entry. |
| 7 | Rule publication tests cover candidate selection and explicit choice for ambiguous configs. |
| 8 | Rule publication tests cover preservation of JSONC comments, duplicate entries, order, and unrelated bytes. |
| 9 | Contract checks require explicit portable placement; end-to-end LLM behavior remains partial, as the current PR notes state. |
| 10 | Contract tests and fixtures check native agent path/frontmatter; runtime inspects agent configuration but does not invoke the fixture. |
| 11 | Contract tests check workflow shape; runtime invokes a workflow authored inside the test, not an AIDD-generated workflow fixture. |
| 12 | Hook-generation contracts check sourced guidance and no declarative output; the current PR notes retain this as partial. |
| 13 | Memory and rule publication have repeatability tests. Idempotence of every model-authored generation flow is not established; partial. |
| 14 | Tests cover refusal/no-partial-write paths, especially memory and rule publication. Full protection across every generator, crashes, and concurrent writers is not established; partial. |
| 15 | CI covers skill runtime consumption, an inline test-authored workflow, and debug/config inspection of saved fixtures across supported platforms. Saved rule consumption, agent invocation, saved workflow invocation, and generator-to-runtime provenance remain partial/unverified. |
| 16 | Kilo path references retain the issue's 2026-09-25 baseline; hook guidance separately records its 2026-11-11 source recheck in `plugins/aidd-context/skills/08-hook-generate/references/tool-paths.md`. |

## Test types

- **Unit/regression tests:** memory sync and rule publication, including preservation, refusal, and repeatability cases: `scripts/__tests__/memory-sync.test.js` and `scripts/__tests__/kilo-rule-publication.test.js`.
- **Contract/fixture tests:** source-contract assertions and checked-in output fixtures; these do not invoke an LLM: `scripts/__tests__/context-kilo-generation-contracts.test.js` and `scripts/__tests__/context-kilo-native-artifacts.test.js`.
- **E2E with scripted provider:** `cli/tests/e2e/kilo-native-generation.e2e.test.ts` uses a local deterministic provider. It consumes a skill assembled by the test, invokes a workflow authored inside the test, and separately inspects checked-in artifact fixtures. The fixture inspection reads project memory; it does not consume the saved rule or invoke the saved agent/workflow.
- **Real LLM evaluation on this HEAD:** none claimed. Historical Codex/Kilo observations retain their original dates and commit references where recorded; the archived phase-2 runtime report does not preserve its exact run SHA. None is current-HEAD evidence.

## What these checks establish

- Contract and fixture tests check generator paths, config preservation/refusal behavior, artifact shape, and supported fields.
- Native Kilo E2E runs Kilo against checked-in fixtures and a deterministic local provider. It verifies runtime discovery and use of the tested fixtures, including positive/negative cases.
- The checks do not establish that every checked-in artifact was generated by a genuine LLM invoking the AIDD generator workflows, nor do they evaluate the quality of generated prose.
- No authenticated Claude Code validation is claimed. `CONTRIBUTING.md` asks contributors to test in Claude Code and another tool; the available CI does not itself demonstrate that host requirement.

## Historical evidence boundary

The [archived phase-2 report](https://github.com/ai-driven-dev/framework/blob/2f1aaadefe15342c5dcb0a1ca73a1846fd470c5c/aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/phase-2-report.md) records an older Kilo 7.8.8/Linux rule-consumption observation, but not the exact run SHA. It and other phase reports are historical only and are not attributed to `f05904e`. Large logs, session exports, local state snapshots, and removed evidence blobs were not copied into this folder. The archive's cleanup report says some exports were removed and no independent integrity copy was retained; no deleted evidence is reconstructed here.
