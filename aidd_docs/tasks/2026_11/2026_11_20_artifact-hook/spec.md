# Artifact check at turn end, tranche 2a

Tranche 2a of #1149: the write hook. Builds on the locked spec `aidd_docs/tasks/2026_11/2026_11_20_contract-validation/spec.md`, which stays unchanged.

## Target

In a user's project, an artifact the model wrote during a turn is judged by its contract before the turn ends, and the model gets each finding back to fix it; a turn with nothing to report stays silent.

## Hard constraints

- Everything in the locked spec still holds: deterministic, no network, Node built-ins only, framework without the CLI, one contract per kind, the checker knows no kind.
- Works on every host that delivers a turn-end event to plugin hooks: Claude Code, Codex, Copilot, Cursor, OpenCode, Kilo. Antigravity delivers none and is out.
- Holds in every install layout (plugin install and flat), so the hook relies only on its own plugin's `hooks/` folder, the one folder every layout ships whole.
- A plugin never reads another plugin's or another skill's folder; what the hook needs from a skill reaches `hooks/` as a generated copy, and a copy that differs from its source is a finding in the repo check.
- The contract stays the single source of where its artifacts live in a user's project; no separate mapping file.
- Only files the model wrote in the current turn are judged; a file the user edited by hand is never reported.
- A contract judges only the formats it can read: the neutral source and the Claude form. Host formats it cannot read (`.toml`, `.mdc`, `.instructions.md`, `.agent.md`, `.prompt.md`) are skipped, never reported.
- A file of a folder artifact is judged with its whole folder, found by its marker inside `aidd_docs/`; with no marker, the file is skipped.
- The hook never fails the tool call or the turn, answers at most once per turn, and stays inside its host's hook timeout.
- A broken contract is reported as one line, never silenced.

## Scope

| Plugin | Artifacts |
| --- | --- |
| aidd-dev | plan and phases, implementation run |
| aidd-pm | user story |
| aidd-context | skill in every host's skill folder; agent and command in their Claude form; rule, neutral source only |

Any contract added later is covered by declaring where its artifacts live, with no change to the hook.

## Non-goals

- Host forms of agents, commands and rules other than the Claude form.
- Contracts for kinds that have none (brainstorm, spec, review, assert, PRD, epic, task, defect, spike, decision record, user hook configuration, others): one batch per plugin, brainstorm, spec, review and assert first, then the backlog, then hooks.
- Memory and UI files, already checked by their own plugin hooks.
- Fixing today's findings in users' projects.
- Writing into `cli/`; an install test proving the hook resolves its copies is a separate ticket needing the user's go.

## Done-when

- In a project with the three plugins, a turn writing a skill, agent, command, rule, plan, phase, run or story that breaks its contract ends with each finding as `file:line rule fix` handed back to the model, on each host above.
- A turn writing a conforming artifact, a file no contract claims, or nothing, produces no output.
- A file edited outside the model's turn is never reported.
- A raw template inside a plugin's `assets/` is never judged when the framework repo uses its own plugins.
- Changing a contract or template in a skill without regenerating the hook copies fails the repo check.
- The repo check, `sync --check` and every repository test pass.

## Open question

- `aidd-context` would hold two turn-end hooks (memory and artifacts) that can both answer; whether each host accepts two answers, or the plugin keeps one turn-end entry, is decided during planning.

## Context

- https://github.com/ai-driven-dev/framework/issues/1149
- Base: https://github.com/ai-driven-dev/framework/pull/1315, https://github.com/ai-driven-dev/framework/pull/1316
