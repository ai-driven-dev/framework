# Verification record

Historical source revision (not the current integration): [`f05904eff0733a37f822aa24d85c380edccbc42f`](https://github.com/ai-driven-dev/framework/commit/f05904eff0733a37f822aa24d85c380edccbc42f), published 2026-11-11. The four linked workflow runs completed successfully for this SHA:

| Workflow | Result |
| --- | --- |
| [cli CI](https://github.com/ai-driven-dev/framework/actions/runs/43083521376) | Success |
| [CI](https://github.com/ai-driven-dev/framework/actions/runs/43083521338) | Success |
| [Validate](https://github.com/ai-driven-dev/framework/actions/runs/43083521162) | Success |
| [CodeQL](https://github.com/ai-driven-dev/framework/actions/runs/43083521124) | Success |

The results and acceptance statuses below describe that historical revision only; they are not evidence for the current integration.

## Reported results

- CLI suite: 7,380 passed, 5 skipped.
- Native Kilo E2E: passed on Windows, Linux, and macOS Intel; the Windows job reports 4/4 native E2E cases.
- Windows CLI passed; no `EBUSY` failure was reported.
- Coverage, mutation partitions, and final CLI gate passed.

## Historical issue acceptance criteria

The [issue](https://github.com/ai-driven-dev/framework/issues/914) defines 16 criteria. The current [PR description](https://github.com/ai-driven-dev/framework/pull/992) also records its partial-coverage notes. This index distinguishes those notes from the test evidence inspected here. `Partial` means the implementation contract has some evidence, but the evidence does not prove every part of the issue wording.

| AC | Historical evidence and status |
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
| 16 | Kilo path references retain the issue's 2026-09-25 baseline; the former hook guidance recorded a 2026-11-11 source recheck; the current guidance is in `plugins/aidd-context/skills/08-hook-generate/actions/01-frame.md`. |

## Current integration review (2026-11-21)

The statuses below apply to integration HEAD `3c584f00613362e835b50ff51a02fcd5724115c2`, including the merge of `d6fcf67e60b29574d8978c5ca422a9b5ff2c6d1b` with `75659dbcebd63e43358a051e092719fe6d52aba1` and the follow-up memory file-race fix. `PARTIAL` identifies missing breadth in direct evidence; it is not automatically a blocker when the missing behavior is outside the stated contract.

| AC | Status | Evidence |
| --- | --- | --- |
| 1 | PARTIAL | `scripts/__tests__/context-kilo-generation-contracts.test.js` checks each applicable guide lists the signals; `scripts/__tests__/context-kilo-native-artifacts.test.js` checks detection fixtures. No E2E runs onboarding and every model-guided generator against one Kilo-only fixture. |
| 2 | PASS | `scripts/__tests__/context-kilo-native-artifacts.test.js` covers the six detection signals; `scripts/__tests__/context-kilo-generation-contracts.test.js` checks guides and rejects `AGENTS.md` / OpenCode-only false positives. |
| 3 | PARTIAL | `scripts/__tests__/kilo-rule-publication.test.js` verifies legacy `.kilocode/` input writes canonical `.kilo/` output. Other generators' legacy behavior is specified in host guides and contract assertions, not exercised end to end. |
| 4 | PASS | Detection fixtures include AGENTS-only and OpenCode-only negatives; generation guide contract tests assert both exclusions. |
| 5 | PASS | `scripts/__tests__/project-memory-script.test.js` verifies user-authored `AGENTS.md` content is retained on repeat wiring; `scripts/__tests__/memory-sync.test.js` verifies shared-target sync and guards. |
| 6 | PASS | `scripts/__tests__/kilo-rule-publication.test.js` checks canonical nested rule output and exact `instructions` wiring; `cli/tests/e2e/kilo-native-generation.e2e.test.ts` verifies Kilo loads the generated rule. |
| 7 | PASS | Rule publication resolves a unique existing owner, retains per-rule ownership in grouped publish, and asks for `--kilo-config` when unresolved/ambiguous (`scripts/__tests__/kilo-rule-publication.test.js`). This follows AC's existing-owner and user-choice rules; it does not impose a global config choice on the batch. |
| 8 | PASS | Rule writer tests cover JSONC comments, duplicates, order, trailing commas, unrelated bytes, and refusal before fan-out on invalid or unsafe config (`scripts/__tests__/kilo-rule-publication.test.js`). |
| 9 | PASS | Skill writer contract requires explicit consent for `.agents/skills/` and forbids duplicate native/portable output; portable and native fixtures verify a single destination (`scripts/__tests__/context-kilo-generation-contracts.test.js`, `scripts/__tests__/context-kilo-native-artifacts.test.js`). |
| 10 | PASS | Agent fixtures and contract tests verify `.kilo/agents/<name>.md`, filename identity, `mode: subagent`, and supported fields; runtime E2E inspects Kilo's loaded generated agent config (`cli/tests/e2e/kilo-native-generation.e2e.test.ts`). |
| 11 | PASS | Workflow fixture checks `.kilo/commands/` and supported frontmatter; runtime E2E runs the generated command and observes its body and arguments (`scripts/__tests__/context-kilo-native-artifacts.test.js`, `cli/tests/e2e/kilo-native-generation.e2e.test.ts`). |
| 12 | PASS | Hook contracts say Kilo is guidance-only, cite `session.created` only where documented, and prohibit unsupported declarative output (`scripts/__tests__/context-kilo-generation-contracts.test.js`). |
| 13 | PASS | Repeat runs are tested for memory, skill scaffolding, agent and command writers, hook writers, and Kilo rule publication; second runs report unchanged/no new output (`scripts/__tests__/project-memory-script.test.js`, `scripts/__tests__/scaffold-skill.test.js`, `scripts/__tests__/agent-generation.test.js`, `scripts/__tests__/command-generation.test.js`, `scripts/__tests__/hook-generation.test.js`, `scripts/__tests__/kilo-rule-publication.test.js`). |
| 14 | PASS | Invalid JSONC, ambiguous/unsafe config, and ownership failures leave the publication snapshot unchanged; staged write/rename failures clean outputs or restore the prior config (`scripts/__tests__/kilo-rule-publication.test.js`). Memory write I/O failures have separate recovery evidence under #1018 below. |
| 15 | PARTIAL | On integration HEAD `3c584f00613362e835b50ff51a02fcd5724115c2`, CI run [44914577137](https://github.com/ai-driven-dev/framework/actions/runs/44914577137) passed the Kilo runtime smoke on Ubuntu, Windows, and macOS Intel; the Windows CLI suite also passed. The native E2E generates and confirms discovery/use of rule/agent/command/skill artifacts on local Linux Kilo 7.7.5. Saved rule consumption, agent invocation, saved workflow invocation, and generator-to-runtime provenance remain unverified. |
| 16 | PASS | Kilo path claims in memory, detection, skill, rule, agent, command, and hook references now carry official Kilo/legacy sources and the required `2026-09-25` verification date. `scripts/__tests__/context-kilo-generation-contracts.test.js` enforces this. |

## Project-memory write-failure boundary (#1018)

At `upstream/next` (`75659dbc`), `project-memory.cjs` writes context files with `fs.writeFileSync` and the shared memory hook's `tryWrite` calls `fs.writeFileSync` directly. A partial write followed by I/O failure can therefore truncate a file, as reproduced by open issue [#1018](https://github.com/ai-driven-dev/framework/issues/1018). The Kilo-specific path added by #992 guards external symlinks, hardlinks and substitutions, writes a private synced recovery copy before changing `AGENTS.md` in place, and reports the recovery path after a partial failure (`plugins/aidd-context/hooks/memory.cjs`, `scripts/__tests__/memory-sync.test.js`). The setup writer likewise retains a backup and reports its path if an in-place write fails (`plugins/aidd-context/skills/02-project-memory/scripts/project-memory.cjs`, `scripts/__tests__/project-memory-script.test.js`).

The in-place update can still leave the destination partially changed after an I/O error or process interruption; recovery is manual from the reported copy. This is not a new regression relative to `upstream/next`, which can truncate without a recovery copy. General transactional recovery, crash recovery automation, and cross-file atomicity remain #1018 scope and are not claimed by #992.

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
