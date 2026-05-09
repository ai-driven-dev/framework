# aidd-orchestrator

Async development orchestration for Claude Code. Label a GitHub issue, get a pull request. Re-label the same issue once you have left review comments, get the feedback applied. v1 ships one use case (async-dev); the plugin is designed to host more orchestration use cases later.

## What it does

`aidd-orchestrator` does not implement the development lifecycle itself. It listens for two GitHub triggers (a label or a comment mention) and delegates the actual work to whichever SDLC orchestration skill is loaded in the runtime, discovered by description match.

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

The two namespaces are strictly separated. Humans never touch `claude/*`. Claude only removes the `to-*` label that triggered a run, and only at lock time.

## Triggers

| Intent                  | Label form     | Mention form                              |
| ----------------------- | -------------- | ----------------------------------------- |
| Implement an issue      | `to-implement` | comment `@claude /implement` on the issue |
| Apply review feedback   | `to-review`    | comment `@claude /review` on the PR       |

The workflow's dispatch step inspects whether the issue has an open linked PR. If yes, the trigger routes to the review skill. Otherwise it routes to the run skill. The same trigger therefore covers both phases.

## Modes

| Mode     | Trigger surface         | Runs on            | Best for                                      |
| -------- | ----------------------- | ------------------ | --------------------------------------------- |
| `remote` | GitHub Actions          | GitHub-hosted runner | Repos with Actions enabled; team workflows  |
| `local`  | Cron / launchd / Desktop scheduled task | Your machine | Offline-first; repos without Actions; quick iterations |
| `both`   | Both surfaces enabled   | Either; deduplicated by `claude/working` lock | Hybrid setups |

The same labels and the same skills drive both surfaces. Concurrency is naturally deduplicated server-side by the `claude/working` lock label, so a remote run and a local run cannot interleave.

## Skills

| Skill                                          | Purpose                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `aidd-orchestrator:01:setup-async-dev`         | Generate the workflow and/or the local poll script, write the config, bootstrap the labels. |
| `aidd-orchestrator:02:run-async-dev`           | Pick a candidate issue, resolve blockers, acquire the lock, delegate to the SDLC capability, audit. |
| `aidd-orchestrator:03:review-async-dev`        | Loop on PR feedback: reply per comment, resolve threads, post a structured summary. |

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

No custom code: the labels drive the columns through the project's built-in automations.

## Setup

### 1. Install the plugin

```bash
claude plugin marketplace add ai-driven-dev/aidd-framework
claude plugin install aidd-orchestrator@aidd-framework
```

Also install one SDLC capability provider on the same marketplace (e.g. `aidd-dev@aidd-framework`). The orchestrator discovers it at runtime by description.

### 2. Run the setup skill in your repo

Open Claude Code in the target repo and run:

```
Use skill aidd-orchestrator:01:setup-async-dev
```

The skill asks five questions:

| # | Question | Default | Notes |
|---|----------|---------|-------|
| 1 | Mode | `both` | `local`, `remote`, or `both` |
| 2 | Anthropic auth | `oauth_token` | OAuth uses your Claude Pro/Max plan; API key is pay-per-token |
| 3 | Marketplace repo | `ai-driven-dev/aidd-framework` | Where the SDLC plugin lives |
| 4 | Marketplace access | `public` | If `private`, asks for the PAT secret name |
| 5 | Max review iterations | `3` | Cap on auto-fix passes per PR |

The skill writes:
- `.github/workflows/aidd-async.yml` (when mode includes `remote`)
- `scripts/aidd-async-poll.sh` and `scripts/aidd-async-poll.scheduler.txt` (when mode includes `local`)
- `.claude/aidd-orchestrator.json` (always)
- The 5 lifecycle labels on the GitHub repo (always)

### 3. Add the secrets

At minimum, one Anthropic auth secret:

| Auth mode | Secret name | How to get it |
| --------- | ----------- | ------------- |
| OAuth | `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` |
| API key | `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |

Plus (private marketplace only):
- the PAT you named (default `AIDD_FRAMEWORK_TOKEN`), a fine-grained PAT with `Contents: Read` on the marketplace repo.

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo OWNER/REPO
```

### 4a. Remote-mode finalisation

```bash
git add .github/workflows/aidd-async.yml .claude/aidd-orchestrator.json
git commit -m "ci: add aidd-orchestrator workflow"
git push
```

The next time you apply `to-implement` on an issue, the workflow runs.

### 4b. Local-mode finalisation

The setup skill drops a poll script and a scheduler snippet:

```
scripts/aidd-async-poll.sh                # the runner
scripts/aidd-async-poll.scheduler.txt     # cron + launchd snippets to copy/paste
```

Pick one of the snippets and install it. Examples:

**cron** (Linux, macOS):
```cron
*/5 * * * * cd /abs/path/to/repo && ./scripts/aidd-async-poll.sh >> /tmp/aidd-async.log 2>&1
```

**launchd** (macOS): copy the `<plist>` from the `.scheduler.txt` file into `~/Library/LaunchAgents/com.aidd.async-poll.plist`, then `launchctl load …`.

**Claude Code Desktop scheduled task**: create a task that runs `./scripts/aidd-async-poll.sh` from the repo root every N minutes.

Manual sanity check:
```bash
./scripts/aidd-async-poll.sh --dry-run    # lists what it would do
./scripts/aidd-async-poll.sh              # runs once for real
```

The script invokes `claude -p` under the hood, so the local machine must have:
- Claude Code installed (`claude --version`)
- `gh auth status` OK
- The `aidd-orchestrator` and SDLC plugins installed at user scope (`claude plugin install …`)

## Daily workflow

| You do | Claude does |
| ------ | ----------- |
| Open an issue and write the spec | nothing yet |
| Apply `to-implement` (or comment `@claude /implement`) | locks (`claude/working`), opens a feature branch, writes code + tests, opens a PR, swaps to `claude/awaiting-review` |
| Read the diff, leave inline review comments | nothing yet |
| Apply `to-review` (or comment `@claude /review` on the PR) | locks again, addresses each comment, replies in-thread, resolves threads, posts a summary, swaps to `claude/awaiting-review` |
| Merge the PR | issue closes; labels remain as-is for audit |

Repeat. The same flow scales to N issues in parallel; each one has its own concurrency group keyed by issue number.

## Failure modes

| Symptom | Cause | What to do |
| ------- | ----- | ---------- |
| `claude/blocked` appears, comment lists missing capability | No SDLC plugin loaded | Install one (e.g. `aidd-dev`), remove `claude/blocked`, re-apply `to-implement` |
| `claude/blocked` appears, comment lists open dependency issues | Issue depends on others not yet merged | Merge or close the blockers, remove `claude/blocked`, re-apply `to-implement` |
| Review loop stops with `max_iterations` | Auto-fix did not converge | Read the summary, push a manual fix, then re-apply `to-review` if you want another pass |
| Review loop stops with `human_reviewer` | A reviewer commented mid-loop | Continue the conversation; the next pass requires an explicit `to-review` |
| Pipeline fails with "Workflow validation failed" | Workflow file diverged on the PR branch from `main` | Use the mention triggers (which run from `main`) until the branch catches up; or rebase the branch |
| Local mode does nothing | `claude` CLI missing, plugin not installed at user scope, or `gh` not authenticated | Run the three checks listed in step 4b |

## Files generated in your repo

| File                                  | Purpose                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `.github/workflows/aidd-async.yml`    | GitHub Actions workflow: dispatch + run + review jobs (remote mode). |
| `scripts/aidd-async-poll.sh`          | Local poll script wrapping `claude -p` (local mode).          |
| `scripts/aidd-async-poll.scheduler.txt` | Ready-to-paste cron and launchd snippets (local mode).      |
| `.claude/aidd-orchestrator.json`      | Runtime config (committed; no secrets).                       |
| `aidd_docs/async-runs/<YYYY_MM>/<run-id>.json` | Per-run audit log: trigger, dependency check, lock timestamps, SDLC outcome, iteration log. |

## Audit and observability

Every run writes a JSON audit record at `aidd_docs/async-runs/<YYYY_MM>/<run-id>.json`. The pipeline also creates a GitHub Check Run named `aidd-async/<run-id>` for the visible run in the PR UI. The summary comment on each PR carries a structured iteration table that links to the commits.

There is no external webhook in v1; the audit log is the source of truth and lives in the repo, versioned and diffable.

## Safety guardrails

- **No push to `main`.** Every run uses a feature branch `feat/issue-<n>-<slug>`. The run skill aborts if delegation would land on the default branch.
- **No auto-merge.** The pipeline ends at PR creation. Review iterations only append commits; humans always merge.
- **Dedicated lock.** A second trigger on the same issue with `claude/working` already set is a no-op, both server-side (workflow `if`) and client-side (script `is_skipped`).
- **Bot loop guard.** Comments authored by `claude[bot]` never re-trigger the workflow; the `if` block filters by `github.event.sender.type`.

## Compatibility

- GitHub repos (private or public). GitLab is not supported in v1.
- Claude Code 2.1+ (uses `--plugin-dir`, `claude plugin marketplace`, `claude plugin install`).
- Node 20+ for the SDLC capability tests it runs (whatever your project requires).
- Bash 3.2 portable for the local poll script (works on stock macOS).

## Limitations

- One SDLC capability per repo: the discovery picks the first match. If two SDLC-advertising plugins are loaded, the tie-break order is documented in `02:run-async-dev/04-check-sdlc.md`.
- Cross-issue dependency auto-unblock is manual: when a blocker closes, you re-apply `to-implement` on the dependent issue. An automatic listener is post-MVP.
- Local mode requires `claude` CLI on the machine; cloud-only setups should use remote mode.
