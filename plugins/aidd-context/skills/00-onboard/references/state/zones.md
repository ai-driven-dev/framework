# State zones

Disk/VCS checks that place the project. `01-scan` reads this. Glyphs: `✓` met · `⚠` drift · `✗` missing.

## Foundations

State-aware order: existing repo (code present) => memory first, bootstrap skipped. Greenfield empty => stack, then memory, then wire.

| Check         | Met `✓`                                                        | Drift `⚠`                          | Deliverable               | Command                          |
| ------------- | -------------------------------------------------------------- | ---------------------------------- | ------------------------- | -------------------------------- |
| tech stack    | `INSTALL.md` exists OR repo established (code or synced memory) | —                                  | tech stack                | `aidd-context:01-bootstrap`      |
| project memory| `aidd_docs/memory/` has real content                           | files empty or placeholder         | project knowledge saved   | `aidd-context:02-project-memory` |
| memory wiring | `<aidd_project_memory>` block on canonical shape in each used tool's context file | block present but off shape | knowledge loaded by the AI | `aidd-context:02-project-memory` |

- tech stack is `✗` only on a truly greenfield repo (no code AND no synced memory). Established => `✓`, never bootstrap.
- memory wiring: an absent block or no context file is `✗`, not `⚠`. `01-scan` loads the canonical block shape to judge drift.

## Dev flow

The official feature flow, cumulative: a downstream artifact implies the upstream stages are met.

```txt
brainstorm → spec* → plan → implement → assert → review → commit → PR    (spec optional)
```

| Stage      | The pin sits here when                              |
| ---------- | -------------------------------------------------- |
| brainstorm | no spec, plan, or code yet (idea only)             |
| spec       | a spec under `aidd_docs/`, nothing downstream      |
| plan       | a `plan.md` under `aidd_docs/`, no code against it |
| implement  | code present against the plan                      |
| assert     | code done, coding assertions not yet green         |
| review     | code done, current branch's PR awaits review       |
| commit     | reviewed, uncommitted or unpushed                  |
| PR         | current branch has an open PR                      |

- `review` and `PR` read cheap VCS state, **current branch only**: the PR whose head is this branch. Ignore repo-wide open PRs and review queues — another branch's PR is another dev's work, never the pin.
- `brainstorm` and `spec` have no hard disk signal; they are the pin only when no downstream artifact exists.
- The plan's `status:` refines the pin: see `hedge.md`.

## Health

Beside-the-flow tools, surfaced only when their signal fires. Scan project source only; exclude templates, fixtures, examples, generated output, and any installed-plugin tree.

| Signal      | Fires when                                | Command             |
| ----------- | ----------------------------------------- | ------------------- |
| no tests    | no real test files                        | `aidd-dev:06-test`  |
| bug markers | `TODO`/`FIXME` or reported errors in source | `aidd-dev:08-debug` |
| messy code  | a file far longer or deeper than siblings | `aidd-dev:04-audit` |
