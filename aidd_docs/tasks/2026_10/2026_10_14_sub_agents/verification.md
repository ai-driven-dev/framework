# Sub-agent verification

## CLI opt-in, 2026-10-15

The four agents are bundled with the CLI, outside plugins. Explicit installation selects a provider and IDE using the [CLI configuration](../../../../cli/src/contexts/tools/domain/formats/agent-models.json). Generic conversion applies no model defaults. Skills remain independent of installation and model selection.

- **CLI:** 17 built-CLI cases pass, covering seven supported provider/IDE pairs, repeat installation, provider changes, removal, invalid selections, personal-file conflicts, cleanup, and a framework distribution without these agents.
- **Ownership:** integration cases cover the project ledger, modified files, safe paths, and cleanup. Removing the ownership guard makes its named test fail; restored code passes. Cleanup preserves personal directory links; restoring recursive directory removal makes that test fail.
- **Limits:** Native files are written directly into each host's agent directory. These checks establish headers and file behavior, not account access or effective runtime model selection.

## Earlier runtime evidence

The runtime probes below describe earlier candidates. Their traces and hashes predate the CLI-installed model defaults and the latest simplified agent bodies.

Verified 2026-10-14 on `feature/sub-agents`: workflow candidate `1f151d19`, delivery candidate `e00f124c`.

## Native roles

| Host | Version | Invoked roles |
| --- | --- | --- |
| Codex | 0.162.1 | explorer, executor, validator, checker |
| Claude Code | 2.1.299 | aidd-dev:explorer, aidd-dev:executor, aidd-dev:validator, aidd-dev:checker |
| OpenCode | 2.0.28 | aidd-dev-explorer, aidd-dev-executor, aidd-dev-validator, aidd-dev-checker |

Native dispatch traces identify the selected roles and fresh child contexts. Agent self-reports alone were not used to establish invocation.

| Scenario | Codex | Claude | OpenCode |
| --- | --- | --- | --- |
| Explorer cites the readiness rule and refuses a conflicting write request | PASS | PASS | PASS |
| Validator reports INCOMPLETE for the failing mandatory check without repair | PASS | PASS | PASS |
| Validator reports BLOCKED without criteria despite an offered green command | PASS | PASS | PASS |
| Executor invokes the installed implement skill for only its assigned phase | PASS | PASS | PASS |
| Fresh validator reports COMPLETE for the repaired, unchanged candidate | PASS | PASS | PASS |
| Checker reviews quality and fitness without modifying the candidate | PASS | PASS | PASS |

Independent final readback found exact bytes `72 65 61 64 79 0a`, a passing `node check.cjs`, and only the assigned phase's lifecycle update. The shared plan, completed prerequisite, check command, and unrelated file retained their baseline contents.

## Parallel implementation

Two native Codex executors used separate supplied worktrees and Git indexes. Their recorded execution intervals overlapped by 19 seconds. Each invoked the installed assigned-phase workflow and committed only its own data file and phase status.

| Phase | Executor commit | Integrated commit | Check |
| --- | --- | --- | --- |
| 1 | 551702df | 5e4bcaa1 | check-a.cjs: READY, exit 0 |
| 2 | add8b135 | 32521585 | check-b.cjs: READY, exit 0 |

The caller integrated both, obtained `BOTH_READY` and exit 0 from `node check-all.cjs`, then committed plan status `implemented` at `c2b8ff32`. Independent readback confirmed the plan and both phases complete, with all three checkouts clean. These commits belong to the disposable probe repository, not the framework.

A restricted-workspace negative probe could not write Git metadata. It reported BLOCKED and left the integrated plan incomplete. The successful disposable probe used the desktop's unrestricted execution profile. No authentication or product security control was changed.

## Real-project planning

The installed planning skill produced three phases in Gouvernail's `2026_10_14_sub_agents_plan_probe` folder: two disjoint diagnostic scripts with no prerequisites, followed by shared package-command wiring depending on both. The phase projections and dependency table were inspected. No application source changed. Session-start memory formatting changes were restored; only the probe artifacts remain.

The large-project planning and review controllers exceeded their imposed time limits after producing the artifacts. Their full interactive completion is not claimed. Codex's combined role controller also exceeded its limit; its native thread subsequently emitted all six results and `turn.completed`. A separate normal-session validator probe exited 0.

## Delivery and gates

`make reload` ran without `PLUGIN`, installing all nine plugins. OpenCode skills and agents were compared with the generated tree; native discovery listed all four roles. Claude's manifest explicitly declares the new agents.

OpenCode's configured local model server was unavailable. Its behavioral probe used the already authenticated `openai/gpt-6.1-sol` through an invocation-only override, with matching `cwd` and `PWD`. Global model and authentication settings were unchanged. Versioned discovery and directory behavior sources are recorded in deployment memory.

The wrapped scripts suite passed 559 tests, including 12 reload regressions. Architecture, JSON manifest validation, Markdown links, duplication checks, and commit hooks passed. These results establish the observed contracts and host paths; they do not guarantee every future task or model choice.

## Earlier four-role candidate, 2026-10-15

The earlier results above describe the previous checker contract. Native runtime probes ran on macOS. Current probes use the four scoped roles: explorer, executor, validator and reviewer. Validator returns one completion verdict; reviewer independently assesses quality. Native dispatch events establish invocation; generated files and agent self-reports alone do not.

| Host | Tested version | Delivery and observed runtime |
| --- | --- | --- |
| Claude Code | 2.1.300 | Generated flat agents. Opus parent and Haiku children resolve to `claude-opus-5-5` / `claude-haiku-5-5`. Native calls request `low`; effective effort is not independently echoed. |
| Codex | 0.145.0 | Installed user agents. Four fresh children report `gpt-5.6-sol` / `low` in native turn contexts. Signed-in backend rejects the suggested newer models. |
| OpenCode | 2.0.28 | Generated project agents. Four native child message records identify their roles and `openai/gpt-6.1-sol#medium`; controller exits 0. An earlier Luna probe had a transport error and is excluded from clean passes. |
| GitHub Copilot | 1.0.98 | Generated marketplace agents invoked through native `--plugin-dir`. Four roles run. Explicit child model `gpt-6-luna` works; actual effort remains `medium` despite requesting low. |
| Cursor | 2026.10.14-941492e | Current official CLI in an isolated download; automatic discovery of four real global local-plugin agents, without `--plugin-dir`. Auto succeeds; the Free account rejects named models. Backend model and effort remain unverified. |

The bounded scenarios cover sourced exploration, implementation output, rejection of a false completion criterion, and independent quality review. Claude's executor changes only the eight assigned modules and passes independent checks. Other four-role probes use text implementation; their files remain unchanged. Cursor's explorer and validator read the actual threshold file; its reviewer also reads the installed quality checklist. Filtered session identities, source hashes, native model metadata and limitations are retained in [runtime.json](runtime.json).

### Direct versus delegated

Same synthetic exploration and repetitive implementation tasks, once per mode. The delegated run includes its Opus parent and fresh Haiku child. Tokens include input, output, cache reads and cache writes; costs are native list-price estimates, not subscription charges.

| Task | Mode | Total tokens | Wall time | Cost estimate, USD |
| --- | --- | ---: | ---: | ---: |
| Exploration | Direct | 136,486 | 26.0 s | 0.2386 |
| Exploration | Delegated | 183,951 | 30.0 s | 0.2130 |
| Implementation | Direct | 136,126 | 21.1 s | 0.2081 |
| Implementation | Delegated | 188,423 | 29.4 s | 0.1899 |

Both retained modes return correct source findings and pass the same independent implementation checks, with no task retries. An earlier implementation pair could not run checks under its Bash permission pattern; both modes were rerun with equal permissions. That excluded attempt is recorded in [comparison.json](comparison.json), alongside quality checks. Separate token-category counts were not retained after fixture cleanup. Different cache states and one observation per mode prevent a general savings claim. Delegation was slower here, with a lower reported cost estimate.

### Reload and finalization

`make reload` exits 0 and refreshes all nine plugins for Claude, Codex, OpenCode, Copilot and Cursor. Native Copilot lists all nine AIDD plugins; Cursor discovers the installed global roles. Byte hashes confirm preservation of 28 personal agent files and personal content in three pre-existing instruction files. Managed global instructions contain only the agent table. Cursor still requires its native Local Plugin Imports policy.

A disposable whole-plan execution invokes `/aidd-dev:02-implement`, repairs the assigned value, runs the mandatory check, then runs the final journey and marks the phase and plan complete. Native tool chronology and the fixture's event ledger show `check` then `journey`, followed by the plan update and no further validation command. The fixture rejects checks after the journey and rejects a journey after premature completion. No commits or pushes occur in that probe.

### Final checks

- **CLI:** after integrating `next` at `0a103e67`, 504 test files pass, one skipped; 6,551 tests pass, one skipped. Architecture, typecheck, lint, type honesty and unused-code gates pass. Bundle is 515.7 KB against Next's 695 KB budget. The local run unsets inherited `CODEX_THREAD_ID` so two imported telemetry fixtures use their own session IDs.
- **Scripts:** the wrapped full suite passes 498 tests after Next retires the previous telemetry suite. Five native-home regressions failed before their default-path corrections and pass afterward; explicit path overrides retain priority. Missing Claude installation paths fail without writing into the current directory; reload fixtures stay in their temporary home.
- **Integration:** the real resolver finds installed agents on all five hosts, preserves project configuration bytes, leaves missing tasks inherited, and rejects unsupported Cursor plugin effort. Actual `make reload` exits 0 after the final corrections; the personal-file preservation check still passes.
- **Guards:** removing the unknown-field rejection and bypassing Claude activation each causes the targeted test to fail. Exact source bytes were restored and the named tests pass; both full native scopes subsequently pass: Cursor 97.4% against 97%, OpenCode 95.0% against 94%, with unchanged floors.
- **Scope:** gather, wireframe, the challenge skill and generic skill generation have no diff against `next`. Generic generation work remains in PR #1028.


### CI follow-up

The first CI run caught a missing smoke command, a stale checker-name expectation in the real Kilo probe, Windows fixture path/JSON issues, and two mutation-floor failures. Only test coverage and fixtures changed afterward; production behavior and mutation floors remain unchanged.

After the Next integration, the smoke suite passes 135 checks with 33/33 commands exercised. Official Kilo 7.7.5 passed its real loopback runtime test with all four current roles before that integration. Windows fixture serialization and native path expectations are covered; Windows execution is checked by the PR's CI jobs.

Fifteen native profile cases cover invalid selector boundaries, malformed option groups, personal agent identity, configuration versus spawn surfaces, and the OpenCode XDG override. Malformed-error assertions now inspect the actual error message; the earlier assertion could accept an undefined rejection. Both complete mutation scopes pass their original floors; exact status counts are retained in [runtime.json](runtime.json).

Six command-wiring cases cover delegation JSON, text, inheritance, diagnostics, required host and failure routing. The existing authentication mutual-exclusion test now supplies a valid storage level, preventing a later guard from masking the one under test. Presentation mutation passes at 95.0187% against the unchanged 95% floor; the removed guard is detected. Production behavior is unchanged by these test corrections.
