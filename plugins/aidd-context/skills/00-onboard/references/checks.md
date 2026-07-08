# Diagnostic catalogue

Every check `01-scan` captures and `02-report` renders, in report order. Four zones. Foundations first, then dev flow, then health.

Each row carries: the **met** rule (a disk fact = `✓`), the **drift** rule (`⚠`, missing or off-format), the **deliverable** named to the user, the canonical **command**, and the **tier** (see `run-tiers.md`). A command resolves to the installed skill by its id, or is named a gap by function when that skill is not installed.

This catalogue **is** the capability map. A newly installed plugin's capability enters `Do this next` only when a row is added here, a deliberate light tradeoff over dynamic discovery.

## Ranking

The order of the `Do this next` list, the single home for this policy:

1. Unmet zone-1 foundations, in table order.
2. The earliest unmet dev-flow step.
3. Any health tool whose signal fired.
4. When 1-3 are all clear (foundations met, no dev-flow step pending, no health signal), the **idle menu**: three plain umbrellas plus explore, never a flat list of cryptic generators.

The idle menu is:

| Slot | Umbrella            | Opens (on pick, a sub-list of the installed members)                                  |
| ---- | ------------------- | ------------------------------------------------------------------------------------- |
| 1    | start new work      | `aidd-dev:00-sdlc` (or `aidd-pm:04-spec` when absent), a feature from idea to shipped  |
| 2    | improve the project | `aidd-dev:04-audit`, `aidd-dev:06-test`, `aidd-dev:07-refactor`                        |
| 3    | customize the AI    | the zone-2 generators for the **missing** artifacts (rule, skill, agent, command, hook), each named in plain words |
| ?    | explore             | `aidd-context:11-explore` and any capability not in slots 1-3 (learn, PM, and the rest) |

Slots 2 and 3 are umbrellas: picking one re-renders its member sub-list to pick from, picking a member runs it. Slot 1 runs directly. Only surface a member that `01` found installed; drop an umbrella with no installed member.

While any zone-1 foundation is unmet, hold the dev-flow, health, and idle-menu steps back, so a bare repo lists only its setup steps. The idle menu opens only at rank 4, never alongside a pending dev-flow step: a project mid-work stays focused on its one next step, an idle project gets the open menu instead of a dead end.

**Done rule (session ledger).** A step is done when a disk signal proves it OR the session ledger recorded it run or left this session. A done step never re-enters `Do this next`. This is the single home for the rule: `01` reads it, `03` writes it, no file. It kills the re-nag for off-disk completions a disk scan cannot see (a read-only review, a MANUAL step left for the user, an explicit skip).

## Zone 1: AIDD context (foundations)

| Check         | Met (`✓`)                                       | Drift (`⚠`)                                              | Deliverable      | Command                    | Tier   |
| ------------- | ----------------------------------------------- | -------------------------------------------------------- | ---------------- | -------------------------- | ------ |
| architecture  | `aidd_docs/INSTALL.md` exists, or the repo is already established (source code or a synced memory bank present) | — | tech stack | `aidd-context:01-bootstrap` | GUIDED |
| memory bank   | `aidd_docs/memory/` exists with real content    | files empty or placeholder                              | project knowledge saved   | `aidd-context:02-project-memory` | GUIDED |
| context block | `<aidd_project_memory>` block present in the AI context file, on the canonical shape | block present but off the canonical shape, see external data (absent block or no context file is `✗`, not `⚠`) | knowledge loaded by the AI    | `aidd-context:02-project-memory` | GUIDED |

Architecture is `❌` only on a truly greenfield repo: no source code **and** no synced memory bank, so the user is told to design a stack. An established project (code present, or the memory bank already synced) has its stack in place, so it is `✅`, never a loud `❌` and never a bootstrap recommendation. Keys on files on disk, not commit history.

## Zone 2: Context-gen artifacts (foundations, optional)

Scoped to **project-level** artifacts only, under the tool's own config root (`.claude/`, `.cursor/`, `.github/`, `AGENTS.md`). Never count a plugin's shipped source: an artifact under `plugins/*/` or any installed-plugin directory is the framework's product, not this project's context, and does not meet these checks.

| Check    | Met (`✓`)                                          | Deliverable | Command                     | Tier   |
| -------- | -------------------------------------------------- | ----------- | --------------------------- | ------ |
| rules    | a project rule file present                        | rules       | `aidd-context:05-rule-generate`   | GUIDED |
| agents   | a project agent under `.claude/agents/` (or peer)  | agents      | `aidd-context:06-agent-generate`  | GUIDED |
| skills   | a project skill under `.claude/skills/` (or peer)  | skills      | `aidd-context:04-skill-generate`  | GUIDED |
| hooks    | a `hooks` entry in the tool's settings             | hooks       | `aidd-context:08-hook-generate`   | GUIDED |
| commands | a project command under `.claude/commands/` (or peer) | commands | `aidd-context:07-command-generate` | GUIDED |

These are optional, never a loud `✗`. They surface only under the idle menu's `customize the AI` umbrella (rank 4, slot 3), each **missing** one a member named in plain words (`a coding rule the AI follows`, `a reusable workflow`, `a specialized assistant`, …); the ones already present are not offered. They are choices, not a chain: the `OK` walk covers ranks 1-3 only, the idle menu is pick-by-number.

## Zone 3: Dev flow

The per-work sequence, in order. Each step resolves to an installed skill by function; the commands below are the canonical resolution.

| Step    | Present when                        | Command (canonical)                | Tier   |
| ------- | ----------------------------------- | ---------------------------------- | ------ |
| clarify | a spec or refined need under `aidd_docs/` | `aidd-pm:04-spec`             | GUIDED |
| track   | a tracked item exists               | `aidd-pm:02-user-stories`          | GUIDED |
| plan    | a `plan.md` under `aidd_docs/`      | `aidd-dev:01-plan`                 | GUIDED |
| build   | code present against the plan       | `aidd-dev:02-implement`            | GUIDED |
| review  | build looks done, nothing reviewed  | `aidd-dev:05-review`               | AUTO   |
| ship    | current branch has an open PR, or is merged and unreleased | `aidd-vcs:02-pull-request`        | MANUAL |

Stages are cumulative. A downstream artifact implies the upstream stages are met, so a project with a plan starts the flow at build, not clarify.

The plan's `status:` frontmatter hedges the build-to-ship pin, so review is never skipped nor premature: `in-progress` pins Build alone; `implemented` or an open PR pins Review then Ship, Review first; an unreadable or absent status pins Build then Review.

`clarify` and `track` have no direct disk signal; they are the place only when no downstream artifact exists, never a loud default. `review` and `ship` read cheap VCS state, current branch only: the PR/MR whose head is this branch, via the project's VCS tool. Ignore repo-wide open PRs and review queues — another branch's PR is another dev's work, never the pin.

## Zone 4: Health (tools, not steps)

A fired health tool enters `Do this next` ranked **after** the earliest dev-flow step, never above it, and never while a zone-1 foundation is unmet (the held-back rule in `## Ranking` applies to health too). It is a beside-the-flow tool, never the ordered default. Scan **project source only**. Exclude templates, fixtures, examples, generated output, and any installed-plugin tree (`plugins/*/`, `.claude/plugins/`, `node_modules/`); a marker inside example or template content is not a real marker.

| Signal            | Met when                              | Deliverable | Command             | Tier |
| ----------------- | ------------------------------------- | ----------- | ------------------- | ---- |
| no tests          | no real test files                    | add tests   | `aidd-dev:06-test`  | GUIDED |
| bug markers       | `TODO` / `FIXME` or reported errors in project source | debug | `aidd-dev:08-debug` | GUIDED |
| messy code sample | a file far longer or deeper than siblings | audit   | `aidd-dev:04-audit` | AUTO |

Reading memory-file contents to judge drift and a single bounded code sample are the only sanctioned non-cheap reads.
