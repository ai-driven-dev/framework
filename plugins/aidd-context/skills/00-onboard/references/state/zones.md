# State zones

Disk/VCS checks that place the project. `01-scan` reads this. Each check is met, drift (present, off canonical shape), or missing. Render glyphs: see `assets/report.md`.

## Foundations

State-aware order: existing repo (code) => memory first, stack skipped. Greenfield empty => stack → memory → wire.

| Check          | Met when                                                       | Drift when              | Deliverable               | Command                          |
| -------------- | ------------------------------------------------------------- | ----------------------- | ------------------------- | -------------------------------- |
| tech stack     | `INSTALL.md` exists OR repo established (code or synced memory) | —                       | tech stack                | `aidd-context:01-bootstrap`      |
| project memory | `aidd_docs/memory/` has real content                          | files empty/placeholder | project knowledge saved   | `aidd-context:02-project-memory` |
| memory wiring  | `<aidd_project_memory>` block on canonical shape in each used tool's context file | block present, off shape | knowledge loaded by the AI | `aidd-context:02-project-memory` |

- tech stack missing only on greenfield (no code AND no synced memory); established = met, never bootstrap.
- memory wiring: absent block or no context file = missing, not drift. `01-scan` loads the canonical shape to judge drift.

## Dev flow

Cumulative: a downstream artifact implies the upstream stages met.

| Stage      | Pin sits here when                          |
| ---------- | ------------------------------------------- |
| brainstorm | no spec/plan/code (idea only)               |
| spec       | spec under `aidd_docs/`, nothing downstream |
| plan       | `plan.md`, no code against it               |
| implement  | code against the plan                       |
| assert     | code done, assertions not green             |
| review     | code done, current branch PR awaits review  |
| commit     | reviewed, uncommitted/unpushed              |
| PR         | current branch has an open PR               |

- Disk/VCS-detectable: `spec`, `plan`, `implement`, `review`, `PR`. `review`/`PR` read VCS **current branch only** — ignore repo-wide PRs and review queues (another branch = another dev, never the pin).
- Inferred, no cheap signal: `brainstorm`, `assert`, `commit`. Placed by the hedge + cumulative state, not disk-pinned.
- Plan `status:` refines the pin: see `hedge.md`.

## Health

Beside-the-flow tools, surfaced only when their signal fires. Scan project source only; exclude templates, fixtures, examples, generated output, installed-plugin trees.

| Signal      | Fires when                                  | Command             |
| ----------- | ------------------------------------------- | ------------------- |
| no tests    | no real test files                          | `aidd-dev:06-test`  |
| bug markers | `TODO`/`FIXME` or reported errors in source | `aidd-dev:08-debug` |
| messy code  | a file far longer/deeper than siblings      | `aidd-dev:04-audit` |
