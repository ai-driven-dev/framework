# Routing: decision tree

Full contract for picking a sub-flow inside `aidd-orchestrator:00-async-dev`. The router walks these signals in precedence order, then applies the conflict resolutions below. A resolved conflict overrides the ordinary signal result.

---

## 1. Explicit override: the arguments keyword

If the arguments are exactly `setup`, `run`, or `review` (case-insensitive), or the prompt contains `action=<keyword>` as a standalone token, route there immediately, subject to conflict resolution below.

This is the contract the bundled CI workflow relies on:

```yaml
prompt: "Use skill aidd-orchestrator:00-async-dev with action=run on issue #..."
prompt: "Use skill aidd-orchestrator:00-async-dev with action=review on PR #..."
```

The router parses `action=<keyword>` from the prompt body. Plain `setup` / `run` / `review` words elsewhere in the body do not count as an override; they may count as natural-language intent. The arguments also match when they consist of exactly one mode keyword.

---

## 2. Trigger env (CI invocation)

When invoked from a GitHub workflow, the router has access to the event context:

| Env / payload                                                 | Route    |
| ------------------------------------------------------------- | -------- |
| `GITHUB_EVENT_NAME=issues` + label `to-implement`             | `run`    |
| `GITHUB_EVENT_NAME=issues` + label `to-review`                | `review` |
| `GITHUB_EVENT_NAME=issue_comment` + body matches `/implement` | `run`    |
| `GITHUB_EVENT_NAME=issue_comment` + body matches `/review`    | `review` |
| `GITHUB_EVENT_NAME=workflow_dispatch` + input `action=<X>`    | maps to `X` |

Comment regex (case-insensitive):

- `run`: `@claude\s+/(implement|aidd-dev:02-implement|run)`
- `review`: `@claude\s+/(review|aidd-dev:05-review)`

---

## 3. Repo state

| Observed state                                                                   | Route                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| `.github/workflows/aidd-async.yml` missing AND `.claude/aidd-orchestrator.json` missing | `setup`                                |
| `.claude/aidd-orchestrator.json` missing but workflow present                    | `setup` (incomplete install)                 |
| Open PR closes the referenced issue                                              | `review`                                     |
| Fresh issue with no linked PR + intent to implement                              | `run`                                        |
| Workflow present + config present + issue + open PR + new comment                | `review` (loop continues)                    |

---

## 4. Natural-language intent

Last-resort heuristic for free-form user input.

| Verbs / phrases in the prompt                                                          | Route    |
| -------------------------------------------------------------------------------------- | -------- |
| `install`, `configure`, `set up`, `bootstrap`, `rotate config`, `re-install`           | `setup`  |
| `implement`, `run`, `process`, `handle queue`, `claude on issue`, `pick up the queue`  | `run`    |
| `address review`, `iterate on PR`, `fix comments`, `handle review`, `apply feedback`   | `review` |

---

## Tie-break: most-specific signal wins

When multiple signals match across categories:

```text
Arguments keyword (1) > trigger env (2) > repo state (3) > NL intent (4)
```

Within a category, the most specific concrete signal wins:

- An explicit mode argument beats a label payload. A PR number identifies the active review surface when repo state is considered.
- A label beats a free-text keyword.
- A specific config file presence beats a generic verb.

---

## Conflict resolution

The router applies these explicit conflict outcomes when the request and state disagree. Only a conflict marked as blocking stops delegation; a conflict resolved to a mode continues through that mode.

Examples:

- **User says "run" but config is absent.**
  Surface the conflict and stop: `Setup must complete before run. Run /aidd-orchestrator:00-async-dev with action=setup first.`
- **Workflow webhook fires `to-implement` but the issue already has an open closing PR.**
  Route to `review` (the PR is the active surface). Comment on the issue: `Issue #N has open PR #M, routed to review instead of run. Apply the `to-review` label to PR #M to trigger review explicitly.`
- **Label `to-implement` AND label `to-review` both present.**
  Route to `review` (more specific to the PR lifecycle). Comment to clarify.

---

## Unresolved: ask the human

If none of the above produces a single match, surface the three sub-flows with their triggers and ask:

```text
Async-dev: which sub-flow?
  - setup  , install / configure async-dev in this repo
  - run    , implement a ready issue (labeled to-implement)
  - review , iterate on review comments for an open PR

Reply with `setup`, `run`, or `review`.
```

Never proceed blindly.

---

## Sub-flow handoff

Once committed, the router invokes the sequence action of the chosen sub-flow:

- `setup` → `actions/setup.md`
- `run` → `actions/run.md`
- `review` → `actions/review.md`

The sub-flow runs to completion (or abort on a pre-flight failure). The router does not re-dispatch mid-flow.
