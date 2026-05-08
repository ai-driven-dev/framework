# aidd-orchestrator

Async development orchestration for Claude Code. Label a GitHub issue, get a pull request. Label a PR's issue, get review feedback applied.

## What it does

`aidd-orchestrator` is an orchestration plugin. It does not implement the development lifecycle itself. It listens for two GitHub triggers (a label or a comment mention) and delegates the actual work to whichever SDLC orchestration skill is loaded in the runtime, discovered by description match.

The plugin keeps the human contract simple: humans only ever set `to-*` labels (or post a mention); Claude only ever sets `claude/*` labels.

## Lifecycle

```
                       Human                                       Claude
                       -----                                       ------

  Issue created
        |
        | apply  to-implement  (or comment @claude /implement)
        v
                                                          claude/working   (lock)
                                                                |
                                                                | run skill
                                                                v
                                                          claude/awaiting-review   (PR open)
        |
        | leave review feedback
        | apply  to-review     (or comment @claude /review on the PR)
        v
                                                          claude/working   (lock)
                                                                |
                                                                | review skill (loop)
                                                                v
                                                          claude/awaiting-review
        |
        | merge the PR
        v
  Issue closed by PR
```

On any failure or unresolved dependency, Claude swaps `claude/working` for `claude/blocked` and posts a comment with the cause.

## Labels

| Label                     | Owner   | Meaning                                                |
| ------------------------- | ------- | ------------------------------------------------------ |
| `to-implement`            | Human   | "Claude, implement this issue."                       |
| `to-review`               | Human   | "Claude, apply the review feedback on the linked PR." |
| `claude/working`          | Claude  | A run is in progress (lock).                          |
| `claude/awaiting-review`  | Claude  | A PR is open and waiting for human review.            |
| `claude/blocked`          | Claude  | Failure or dependency blocker; human action needed.   |

The two namespaces are strictly separated. Humans never touch `claude/*`. Claude never touches `to-*` (other than to remove a `to-*` once the lock is acquired).

## Triggers

| Intent                  | Label form     | Mention form                              |
| ----------------------- | -------------- | ----------------------------------------- |
| Implement an issue      | `to-implement` | comment `@claude /implement` on the issue |
| Apply review feedback   | `to-review`    | comment `@claude /review` on the PR       |

The workflow's dispatch step inspects whether the issue has an open linked PR. If yes, the trigger routes to the review skill. Otherwise it routes to the run skill. The same trigger therefore covers both phases.

## Skills

| Skill                             | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `aidd-orchestrator:01:setup`         | Generate the workflow, write the config, bootstrap the labels.  |
| `aidd-orchestrator:02:run`           | Pick a candidate, resolve blockers, lock, delegate, audit.      |
| `aidd-orchestrator:03:review`        | Loop on PR feedback, reply per comment, resolve threads, summarise. |

The plugin also ships an `async-orchestrator` agent that wraps the run/review choice for direct invocation.

## Project board (optional)

GitHub Projects v2 maps labels to columns natively. A typical board:

| Column            | Auto-add rule                              |
| ----------------- | ------------------------------------------ |
| Backlog           | issue created without a `to-*` label       |
| Ready             | label `to-implement` or `to-review` added  |
| In progress       | label `claude/working` added               |
| Awaiting review   | label `claude/awaiting-review` added       |
| Blocked           | label `claude/blocked` added               |
| Done              | issue closed                               |

No custom workflow is needed; the labels drive the columns.

## Setup

1. Install the plugin via the marketplace.
2. Run the `aidd-orchestrator:01:setup` skill in your repo. It asks five questions:
   - mode (`local` / `remote` / `both`)
   - Anthropic auth (`oauth_token` / `api_key`)
   - marketplace repo and access (`public` / `private`)
   - max review iterations (default `3`)
3. Add the secrets the setup output prints. At minimum you need one of:
   - `CLAUDE_CODE_OAUTH_TOKEN` (for Claude Pro/Max subscriptions; generate via `claude setup-token`)
   - `ANTHROPIC_API_KEY` (for pay-per-token billing)
   And, when the marketplace repo is private:
   - the PAT secret you named (default `AIDD_FRAMEWORK_TOKEN`).
4. Ensure an SDLC orchestration skill is published on the marketplace -- the plugin discovers it at runtime by description.
5. Apply `to-implement` on a ready issue and watch the action run.

## Failure modes

- **No SDLC capability loaded** -- the run skill aborts at the discovery step and posts a comment naming the missing capability.
- **Open dependency on another issue** -- the run skill posts a comment listing the open blockers and applies `claude/blocked`.
- **Tests fail after a fix iteration** -- the review loop retries up to `max_iterations` times, then stops with `max_iterations` and pings a human.
- **Reviewer comments mid-loop** -- the loop stops with `human_reviewer`. The next pass requires an explicit `to-review` trigger.

## Files generated in your repo

| File                              | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `.github/workflows/aidd-async.yml`| GitHub Actions workflow with the dispatch + run + review jobs.  |
| `.claude/aidd-orchestrator.json`     | Runtime config (committed; no secrets).                         |
| `aidd_docs/async-runs/<ym>/<id>.json` | Per-run audit log written by the pipeline.                  |
