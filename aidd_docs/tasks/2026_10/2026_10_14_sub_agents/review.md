# Review: scoped sub-agents

- Rounds: 5
- Started: 2026-10-15

## Round 1 · r-1fd6

- Date: 2026-10-15
- By: alexsoyes
- Diff: `origin/next...513d323c0dcb431aa936e56bf4be16945e39ec57`
- Axes: code, relevancy
- Verdict: changes-requested
- Score: not scored

### Findings

- `plugins/aidd-orchestrator/skills/01-sdlc/references/02-deliver.md:49` : Delegated delivery sends the required final journey into Finalize, whose first step runs plan validation again (`02-implement/actions/03-finalize.md:13`). The journey is therefore no longer last → perform integrated validation before that journey and mark completion after it passes; major, fit
- `plugins/aidd-context/skills/06-agent-generate/references/agent-authoring.md:25` : The changed contract requires canonical recipe addresses, while the copied scaffold still prescribes capability discovery for cross-plugin recipes (`assets/agent-template.md:18`; `actions/02-write-agent.md:15` copies it) → align the scaffold with the contract; major, architecture
- `plugins/aidd-dev/skills/02-implement/actions/02-execute.md:17` : Missing dependencies demand replanning, while line 15 gives undeclared dependencies a serial fallback → distinguish absent declarations from unresolved referenced prerequisites; minor, error-handling
- `docs/ARCHITECTURE.md:145` : Rewriting general cross-plugin provider discovery is unnecessary for adding sub-agents; agent permission addressing already has its own row → retain the existing provider rule; minor, fit

## Round 2 · r-7c2a

- Date: 2026-10-15
- By: alexsoyes
- Diff: `origin/next...513d323c0dcb431aa936e56bf4be16945e39ec57` plus the working tree
- Axes: code, relevancy
- Verdict: changes-requested
- Score: not scored

### Findings

- `plugins/aidd-orchestrator/skills/01-sdlc/references/02-deliver.md:7` : The local correction makes every executor stop after Execute, including whole-plan executors, while the implementation router still instructs whole-plan calls to run Prepare, Execute and Finalize (`02-implement/SKILL.md:26`). The caller must override that routing and resume inside another action → preserve the normal whole-plan route and keep shared integration/finalization ownership specific to delegated phases; major, architecture
- `plugins/aidd-dev/skills/02-implement/actions/02-execute.md:16` : Distinct checkouts/Git indexes are mandatory for parallel execution even when workers own disjoint files and leave Git operations to the caller → require independent writes and validation resources; require separate indexes only when workers also perform Git operations; minor, fit
- `plugins/aidd-dev/agents/validator.md:19` : A two-sentence maximum can hide distinct failures or verification blockers; the requested concise verdict does not need a fixed sentence count → retain one verdict and concise decisive evidence without the numeric cap; minor, fit


## Round 3 · r-983d

- Date: 2026-10-15
- By: independent reviewer for CLI; caller for workflow and scope
- Diff: final working candidate
- Axes: code, relevancy
- Verdict: approve
- Score: not scored

### Resolved

- **Workflow:** whole-plan execution retains its normal route. Assigned phases return for integration and one finalization; the required journey runs last before completion. The native whole-plan probe confirms that order.
- **Boundaries:** uncertain dependencies run serially; separate Git indexes are required only when workers perform Git operations. Validator retains one concise verdict without an arbitrary sentence cap. The template describes capabilities rather than ordered steps.
- **Native discovery:** independent rereview confirms the four original CLI findings are resolved: Copilot catalogue/cache paths, Claude activation, Copilot personal precedence and native configuration homes. The generated-catalogue regression also covers `metadata.pluginRoot`.
- **Reload safety:** an empty Claude cache glob now reaches the existing missing-install-path error. Regression fixtures run inside their temporary home; both cases failed before correction and pass afterward.
- **Evidence:** real five-host resolution succeeds without configuration writes. Ambiguous Copilot cross-tool settings fail actionably; higher-scope overrides resolve them. Effective runtime remains unknown until native traces establish it.
- **Scope:** unrelated cross-plugin provider wording is restored. Gather, wireframe and generic skill generation remain unchanged against `next`; Batch drops the mandatory refine pipeline that exceeded a bounded executor's responsibility.

No consequential new findings in the scoped rereview. Full test results and native limitations are recorded in [verification.md](verification.md).


## Round 4 · r-ci

- Date: 2026-10-15
- By: independent mutation reviewer; caller for verification
- Diff: CI follow-up after `6b5f5f58`
- Axes: verification, relevancy
- Verdict: approve local corrections
- Score: not scored

- **CI coverage:** register the new smoke command, require the four current roles in the real Kilo probe, and serialize Windows fixture paths correctly.
- **False-positive assertion:** replace the malformed-error assertion that accepted an undefined rejection with an actual error-message check.
- **Native boundaries:** add 15 meaningful cases in existing profile tests. Keep equivalent object serialization and unchanged baseline metadata out of scope.
- **Results:** full mutation scopes pass at Cursor 97.4% / floor 97 and OpenCode 95.0% / floor 94. No production or threshold changes in these corrections.

## Round 5 · native model configuration

- Date: 2026-10-15
- By: independent reviewer
- Diff: replacement of runtime resolution with CLI-installed native headers
- Axes: code, relevancy
- Verdict: no actionable findings
- Score: not scored

- **Configuration:** one CLI JSON owns provider defaults, native fields and the Copilot alias. Explicit native choices survive; defaults stay scoped to the four AIDD roles.
- **Simplicity:** resolver machinery and workflow dependencies are removed. Agent behavior is limited to three capabilities per role.
- **Evidence:** 6,499 CLI tests and 498 script tests pass, including nine built-CLI header cases. Existing Codex/Cursor plugin limitations remain explicit; effective runtime selection is not claimed from generated files.
