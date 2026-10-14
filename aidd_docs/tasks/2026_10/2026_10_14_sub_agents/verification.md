# Sub-agent verification

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
