# 06 - Validate end-to-end

Spawn one agent per action of the target skill, run its `## Test`, aggregate into a single pass/fail table.

## Inputs

- `skill_path` (required) - absolute path to the target skill (e.g. `.claude/skills/<skill>`)

## Outputs

A single markdown table delivered to the user. One row per action, in numeric order:

| Action               | Test                                                              | Statut |
| -------------------- | ----------------------------------------------------------------- | ------ |
| `post-message`       | Posted "ping" to #test, verified via `slack_get_channel_history`  | ✅     |
| `fetch-week-tasks`   | Queried Notion DB for user X, expected ≥ 1 result                 | ✅     |
| `archive-channel`    | -                                                                 | ⏭️     |

`✅` pass, `❌` fail, `⏭️` skipped (e.g. action 02 when manual-only).

## Process

1. For each action file in `<skill_path>/actions/`, in numeric order, spawn a fresh agent (`Task`/`Agent`, `subagent_type: general-purpose`) with **empty context**. The brief is self-contained and includes:
   - **`<skill_path>/SKILL.md`** - the skill's router, transversal rules.
   - **The action file itself** - `## Inputs`, `## Outputs`, `## Process`, `## Test`.
   - **Every file referenced by `@<path>` inside the action** - templates, references, helpers.
   - **A concrete value for each `## Inputs` field**, derived from the action's input declaration (or upstream action's outputs if depends_on).
   - **`cwd`** = repo root.
   - **Instruction** : execute `## Process`, then run the `## Test`; report pass/fail and the cause if fail in ≤ 100 words.
2. Capture for each action: slug, the `## Test` sentence verbatim, status. Add a row.
3. On `❌`, the agent diagnoses the root cause, **resolves it in the real environment** (install MCP, generate API key per `.env.local`, authenticate, etc.), then **patches the action source file on disk** to point to the working solution. Re-run `## Test` via a fresh agent. Repeat until ✅. The patched action is the documentation - no separate change log.
4. If `disable-model-invocation: false` in `<skill_path>/SKILL.md`: for each scenario in `<skill_path>/evals/scenarios.json`, spawn one fresh agent that reproduces the prompt verbatim and reports whether the dispatched action matches `expect_action`. Add one row per scenario.
5. Always deliver the table at the end, even if every row is ✅.

## Test

The report is a single markdown table with the three columns `Action | Test | Statut`; every row uses ✅/❌/⏭️; every action of the target appears as a row; every action that ended ✅ after a fix has its source file actually modified on disk (not just retried in conversation).
