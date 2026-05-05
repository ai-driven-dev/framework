---
name: aidd-dev:00:sdlc
description: Pure orchestrator for the full AIDD development flow. Use when a human (or Gardener) needs to take a free-form request from idea to shipped code, end-to-end. Coordinates spec generation, planning, implementation, and review by composing other skills and agents. Holds no business logic of its own — every step is delegated.
---

# Skill: sdlc

Pure orchestrator. Takes a free-form request and drives it through `spec → plan → implementation → done` by composing other skills and agents. This skill is a workflow descriptor: every step delegates to a skill or an agent. No business logic lives here.

## When to use

- A human invokes `/sdlc <request>` to start a new run from a free-form description
- A Gardener (async) decides a new run is needed and invokes this skill
- A previous run was paused and needs to be resumed with refined input

## When NOT to use

- A spec already exists and is validated → invoke the `planner` agent directly
- A milestone implementation is needed in isolation → invoke the `implementer` agent directly
- A standalone review is needed → invoke the `reviewer` agent directly
- A human just wants a draft spec without execution → invoke `aidd-pm:05:spec` directly

## Inputs

At least one of `request` or `prd_path` is required. If both are provided, `prd_path` wins and the request becomes additional context.

```yaml
request: <free-form human description of what to build, optional>
prd_path: <path to an existing PRD file, optional>
working_dir: <optional — defaults to current working directory>
options:
  quality_threshold: <0-100, default 90>
  retry_cap_per_step: <n, default 3>
  open_pr: <true | false, default false>
```

Commits are **always** produced — at every phase boundary and at every ticked checkbox during implementation. There is no `auto_commit: false` mode. The audit trail is mandatory.

## Outputs

```yaml
status: done | blocked | aborted
spec_path: <path to validated spec>
plan_summary: <count of milestones, count of decisions made/blocked>
commits:
  spec_validated: <sha>
  plan_validated: <sha>
  per_milestone: [<sha>, ...]
  final: <sha if status=done>
pr_url: <if open_pr and status=done>
duration: <hh:mm>
notes: <relevant observations>
```

## Orchestration

Four phases. Each phase delegates. Defaults below are overridable per invocation via `options`.

### Phase 1 — Spec generation and validation

1. Invoke `aidd-pm:05:spec` with `request` and/or `prd_path`. Output: a draft spec at `working_dir/spec.md`.
2. Spawn `reviewer` agent with:
   - artifact: the draft spec
   - validator: `{{TOOLS}}/plugins/aidd-pm/skills/05-spec/assets/spec-validator.yml` (filesystem path, resolved by Claude Code)
3. Read the reviewer's output:
   - `completion_score = 100` and `quality_score >= quality_threshold` → proceed to step 4
   - `quality_score < quality_threshold` → re-invoke `aidd-pm:05:spec` with the reviewer's findings as input, retry
   - Beyond `retry_cap_per_step` retries → escalate to human, return with `status: blocked`
4. **Commit the validated spec** via `aidd-vcs:01:commit` with `mode: auto`, `message: "spec: <feature-name> validated"`, `files: [<spec_path>]`, `push: false`. Record the returned `commit_sha` in `commits.spec_validated`.

### Phase 2 — Planning

1. Spawn `planner` agent with the validated spec.
2. The planner uses `aidd-dev:01:plan` internally. The skill writes to `aidd_docs/tasks/<yyyy_mm>/...md` (simple plan) or to `*-master.md` plus one `*-part-N.md` per child plan (master plan). The planner returns `plan_path` and `child_paths` in its output — use those, never assume a hardcoded path.
3. Read the planner's output:
   - `plan_path` empty → planner failed to produce a plan, retry once then escalate
   - `decisions_blocked` non-empty → ask the human, get answers, re-spawn the planner with the answers as input
   - `plan_status: blocked` → escalate, return with `status: blocked`
   - Beyond `retry_cap_per_step` retries → escalate to human
4. **Commit the validated plan** via `aidd-vcs:01:commit` with `mode: auto`, `message: "plan: <feature-name> validated"`, `files: [<plan_path>, ...child_paths]`, `push: false`. Record the returned `commit_sha` in `commits.plan_validated`.

The plan does not require a separate validator pass at this stage. The planner's structural output is used as-is. A plan validator may be added later if the run pattern reveals gaps.

### Phase 3 — Implementation

1. Hand the validated plan back to the `planner` for execution. Pass `plan_path` and any `child_paths` from Phase 2 — the planner reads them to drive the loop. The planner now drives the milestone-by-milestone loop in its own context:
   - **Simple plan** (`child_paths` empty): one `plan_path`, milestones live inside it.
   - **Master plan** (`child_paths` non-empty): the master enumerates child plans; the planner sequences them, processing milestones from each child in order.
   - For each milestone, the planner spawns `implementer` (fresh) and then `reviewer` (fresh, with the milestone's acceptance criteria as validator).
   - The planner re-spawns until quality passes its threshold or it escalates.
   - **The implementer commits atomically per ticked acceptance criterion checkbox** (one criterion = one commit, message: `<milestone-id>/<step>: <description>`). Tasks under each phase guide HOW to implement; acceptance criteria are the verified states that trigger commits. This produces the per-milestone commit trail recorded in `commits.per_milestone`.
2. The planner returns when `plan_status: done` or `plan_status: blocked`.
3. If `blocked` → escalate to human. The human may refine the spec and the run can resume from Phase 1, or abort.

### Phase 4 — Finalize

1. Write a run summary (decisions, milestones, final state, commit shas) at `working_dir/summary.md`.
2. **Final commit** via `aidd-vcs:01:commit` with `mode: auto`, `message: "feat: <feature-name> complete"`, `files: [<summary_path>]`, `push: <open_pr>` (push only if a PR is requested). Record the returned `commit_sha` in `commits.final`.
3. If `open_pr: true` → invoke `aidd-vcs:02:pull-request`. Record the URL in `pr_url`.
4. Return the structured output.

## Skills and agents this skill uses

- Skills: `aidd-pm:05:spec`, `aidd-dev:01:plan`, `aidd-vcs:01:commit`, `aidd-vcs:02:pull-request`
- Agents: `planner`, `reviewer`

The `implementer` agent is spawned by the `planner` during Phase 3, not by this skill directly.

## Quality threshold and retry caps

Both are overridable per invocation via `options`. Defaults (quality 90, cap 3) are a balanced setup for general-purpose runs. Tighten for production-critical work, loosen for prototypes.

## Escalation protocol

When a step exceeds `retry_cap_per_step`:
1. Stop the run.
2. Surface the blocker, the latest output, and the suspected cause to the human.
3. Wait for human input or human-driven restart. Don't silently continue.
