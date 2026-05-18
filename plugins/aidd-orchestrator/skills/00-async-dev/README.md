← [aidd-framework](../../../../README.md) / [aidd-orchestrator](../../README.md)

# 00 - Async-dev

Single entry point for the async-dev pipeline. Hybrid router that picks one of three internal sub-flows (`setup`, `run`, `review`) from `$ARGUMENTS` keyword, trigger source, repo state, or natural-language intent, then runs that sub-flow to completion.

## When to use

- You want to install / configure async-dev in a repo.
- A GitHub event fires (`to-implement` / `to-review` label, `@claude /implement` or `/review` comment) and the workflow needs to react.
- You want to handle a ready issue or address review comments on an open PR.
- The user types "async dev", "/async-dev", or mixes phases ("set up async dev and run on issue 42").

## When NOT to use

- For plain status checks on the async pipeline (read labels / comments directly).
- For SDLC orchestration unrelated to issue / PR automation (use `aidd-dev:00-sdlc`).
- From inside a sub-flow action — actions never re-enter the router.

## How to invoke

```text
Use skill aidd-orchestrator:00:async-dev
```

With an explicit sub-flow keyword (preferred from CI):

```text
Use skill aidd-orchestrator:00:async-dev with action=setup
Use skill aidd-orchestrator:00:async-dev with action=run on issue #42
Use skill aidd-orchestrator:00:async-dev with action=review on PR #17
```

The router reads `$ARGUMENTS`, then trigger env, then repo state, then natural intent. See [`references/routing.md`](references/routing.md) for the full decision tree.

## Sub-flows

| Sub-flow | First action                                       | Cardinality        |
| -------- | -------------------------------------------------- | ------------------ |
| Setup    | [`actions/setup/01-detect-context.md`](actions/setup/01-detect-context.md)       | 11 actions, run once per install |
| Run      | [`actions/run/01-poll-ready.md`](actions/run/01-poll-ready.md)                   | 6 actions, run once per ready issue |
| Review   | [`actions/review/01-collect-comments.md`](actions/review/01-collect-comments.md) | 4 actions, looped on the PR until stop |

## Outputs

Each sub-flow defines its own outputs:

- **Setup**: workflow file, config file, scripts, labels, schedule routine id (if applicable).
- **Run**: `run-result.json` artefact consumed by the workflow's post-job.
- **Review**: stop-reason + structured summary comment on the PR.

## Technical details

See [`SKILL.md`](SKILL.md) for the hybrid routing contract, sub-flow indexes, and rules.
See [`references/routing.md`](references/routing.md) for the full decision tree.
