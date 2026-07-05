# Diagnostic catalogue

Every check `01-scan` captures and `02-report` renders, in report order. Four zones. Foundations first, then dev flow, then health.

Each row carries: the **met** rule (a disk fact = `✓`), the **drift** rule (`⚠`, missing or off-format), the **deliverable** named to the user, the canonical **command**, and the **tier** (see `run-tiers.md`). A command resolves to the installed skill by its id, or is named a gap by function when that skill is not installed.

## Ranking

The order of the `Do this next` list, the single home for this policy:

1. Unmet zone-1 foundations, in table order.
2. The earliest unmet dev-flow step.
3. Any health tool whose signal fired.

While any zone-1 foundation is unmet, hold the dev-flow and health steps back, so a bare repo lists only its setup steps. Zone-2 artifacts never enter this list; surface one only when the user picks it.

## Zone 1: AIDD context (foundations)

| Check         | Met (`✓`)                                       | Drift (`⚠`)                                              | Deliverable      | Command                    | Tier   |
| ------------- | ----------------------------------------------- | -------------------------------------------------------- | ---------------- | -------------------------- | ------ |
| architecture  | `aidd_docs/INSTALL.md` exists                   | —                                                        | stack design     | `aidd-context:01-bootstrap` | GUIDED |
| memory bank   | `aidd_docs/memory/` exists with real content    | files empty or placeholder                              | project memory   | `aidd-context:02-project-memory` | GUIDED |
| context block | `<aidd_project_memory>` block present in the AI context file, on the canonical shape | block present but off the canonical shape, see external data (absent block or no context file is `✗`, not `⚠`) | memory wiring    | `aidd-context:02-project-memory` | GUIDED |

Architecture is only `❌` on a truly greenfield repo: no source code **and** no synced memory bank. An established project (code present, or the memory bank already synced) has moved past stack design, so the check is **not applicable** (`➖`), not a loud `❌`, and never recommends bootstrap. Keys on files on disk, not commit history.

## Zone 2: Context-gen artifacts (foundations, optional)

Scoped to **project-level** artifacts only, under the tool's own config root (`.claude/`, `.cursor/`, `.github/`, `AGENTS.md`). Never count a plugin's shipped source: an artifact under `plugins/*/` or any installed-plugin directory is the framework's product, not this project's context, and does not meet these checks.

| Check    | Met (`✓`)                                          | Deliverable | Command                     | Tier   |
| -------- | -------------------------------------------------- | ----------- | --------------------------- | ------ |
| rules    | a project rule file present                        | rules       | `aidd-context:05-rule-generate`   | GUIDED |
| agents   | a project agent under `.claude/agents/` (or peer)  | agents      | `aidd-context:06-agent-generate`  | GUIDED |
| skills   | a project skill under `.claude/skills/` (or peer)  | skills      | `aidd-context:04-skill-generate`  | GUIDED |
| hooks    | a `hooks` entry in the tool's settings             | hooks       | `aidd-context:08-hook-generate`   | GUIDED |
| commands | a project command under `.claude/commands/` (or peer) | commands | `aidd-context:07-command-generate` | GUIDED |

These are optional and **info only**: show their status in the checklist, never a loud `✗`. Ranking (above) keeps them out of `Do this next` and the `OK` walk.

## Zone 3: Dev flow

The per-work sequence, in order. Each step resolves to an installed skill by function; the commands below are the canonical resolution.

| Step    | Present when                        | Command (canonical)                | Tier   |
| ------- | ----------------------------------- | ---------------------------------- | ------ |
| clarify | a spec or refined need under `aidd_docs/` | `aidd-pm:04-spec`             | GUIDED |
| track   | a tracked item exists               | `aidd-pm:02-user-stories`          | GUIDED |
| plan    | a `plan.md` under `aidd_docs/`      | `aidd-dev:01-plan`                 | GUIDED |
| build   | code present against the plan       | `aidd-dev:02-implement`            | GUIDED |
| review  | build looks done, nothing reviewed  | `aidd-dev:05-review`               | AUTO   |
| ship    | an open PR, or merged and unreleased | `aidd-vcs:02-pull-request`        | MANUAL |

Stages are cumulative. A downstream artifact implies the upstream stages are met, so a project with a plan starts the flow at build, not clarify. Build never proves review or ship, so surface both when code looks done and let the user pick.

`clarify` and `track` have no direct disk signal; they are the place only when no downstream artifact exists, never a loud default. `review` and `ship` read cheap VCS state (an open PR), not a pure disk fact.

## Zone 4: Health (tools, not steps)

A fired health tool enters `Do this next` ranked **after** the earliest dev-flow step, never above it, and never while a zone-1 foundation is unmet (the held-back rule in `## Ranking` applies to health too). It is a beside-the-flow tool, never the ordered default. Scan **project source only**. Exclude templates, fixtures, examples, generated output, and any installed-plugin tree (`plugins/*/`, `.claude/plugins/`, `node_modules/`); a marker inside example or template content is not a real marker.

| Signal            | Met when                              | Deliverable | Command             | Tier |
| ----------------- | ------------------------------------- | ----------- | ------------------- | ---- |
| no tests          | no real test files                    | add tests   | `aidd-dev:06-test`  | GUIDED |
| bug markers       | `TODO` / `FIXME` or reported errors in project source | debug | `aidd-dev:08-debug` | GUIDED |
| messy code sample | a file far longer or deeper than siblings | audit   | `aidd-dev:04-audit` | AUTO |

Reading memory-file contents to judge drift and a single bounded code sample are the only sanctioned non-cheap reads.
