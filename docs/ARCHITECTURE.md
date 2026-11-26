# Architecture

Where a capability belongs.

Terms: [Concepts](CONCEPTS.md).

## Anatomy of a plugin

Only the manifest and the skills are required.

| Component | Location |
| --- | --- |
| Manifest | `.claude-plugin/`, holding `plugin.json` |
| Skill | `skills/<name>/SKILL.md` |
| Actions | `skills/<name>/actions/` |
| Assets | `skills/<name>/assets/` |
| References | `skills/<name>/references/` |
| Contract | `skills/<name>/scripts/contract.json`, its rules for the files the skill writes |
| Agents | `agents/` |
| Commands | `commands/` |
| Hooks | `hooks/hooks.json` and its scripts |
| MCP configuration | `.mcp.json` |
| Documentation | `README.md`, `CATALOG.md` (generated), `CHANGELOG.md` |

Project rules live in your tool's rules directory, such as `.claude/rules/`.

`aidd-context` generates them.

## Who owns what

Put each capability in the plugin that owns its concern.

Every other plugin delegates to it.

| Plugin | Owns |
| --- | --- |
| `aidd-context` | Project knowledge: memory, context files, generators |
| `aidd-pm` | Product management: briefs, epics, stories, specs |
| `aidd-refine` | Thinking about the work: brainstorm, challenge, fact-check |
| `aidd-dev` | Code: plan, build, validate, review, debug |
| `aidd-vcs` | Version control: commits, pull requests, tags |
| `aidd-orchestrator` | Running other skills end to end |
| `aidd-ui` | UI and UX design |
| `aidd-qa` | Acceptance QA with video evidence |
| `aidd-telemetry` | Token measurement |

## How a skill runs

```mermaid
flowchart LR
  you(["You"]) --> skill["Skill"] --> action["Action"] --> result(["Result or file"])
  orchestrator["Orchestrator"] --> skill
  orchestrator -->|isolated work| subagent["Subagent"] --> skill
  classDef step fill:#e9ddff,stroke:#8250df,color:#3b1d78
  classDef edge fill:#ddf4ff,stroke:#0969da,color:#0a3069
  class skill,action,orchestrator,subagent step
  class you,result edge
```

| Role | Rule |
| --- | --- |
| Skill | Runs in the caller's context. Holds no logic, only its actions. |
| Caller | The session or skill that delegates. Owns scope, integration and acceptance. |
| Orchestrator | Sequences capabilities for the caller. |
| Subagent | Takes a scoped brief and returns only a result to the caller. Never calls an orchestrator. |
| Delegation | At most two layers, no cycles. |

## Rules that keep plugins independent

1. A skill links only inside its own directory.
2. A bundled script is named in backticks, never linked.
3. Address another plugin as `/plugin:folder` only in dispatch tables and orchestration references.
4. Find a provider in another plugin by its description.
5. Keep a bundled script's tests in `scripts/__tests__/`, never in the plugin.
6. Write only what the target tool supports.
7. Delegate agent work by responsibility, never by agent name.

## Contracts

A contract states the shape of the files a skill writes, so a script judges it, never a model. One engine, `scripts/check/engine/`, reads every contract; the skill carries a copy to validate its own output, the hook another to recheck it at turn end.

| Key | Holds |
| --- | --- |
| `kind` | the rule ID prefix: `spec` gives `SPEC-01` |
| `unit` | `file`, or `folder` judged as one artifact |
| `marker` | the file that makes a folder an artifact, required for `folder` |
| `scope` | where the artifacts live in a user's project; the hook judges only these |
| `targets` | where they live in this repository; CI judges only these |
| `shell` | `false` when an install writes the kind: a shell turn then judges only the files a command names |
| `watch` | the paths whose change reruns every target in a scoped run |
| `rules` | each rule by ID |

| Rule key | Holds |
| --- | --- |
| `op` | the check, from the table below |
| `in` | the files of the unit the rule judges; required for `folder`, every file by default |
| `notIn` | the files it skips |
| `fix` | the only text the agent reads: what to do, never why |
| `why` | for the maintainer, never printed |

| Op | Fails when |
| --- | --- |
| `template` | the file breaks its template; `optional` names the fields and sections it may omit, `values` a field's allowed values |
| `pattern` | `regex` misses a `field`, a `line` or a prose line, or every one with `any` |
| `forbidden` | `regex` matches one |
| `max` | a value is over `max` chars, or the file over `max` lines |
| `equals` | a field differs from `to`, the file's basename or its folder |
| `sections` | a heading at `level` is not `allowed`, out of `order`, or a `required` one is missing |
| `oneSentence` | a bullet in `sections` holds two sentences |
| `flatList` | a list in `sections` nests |
| `links` | a relative link resolves nowhere, or, with `inside`, outside the unit |
| `json` | the file breaks `schema` |
| `custom` | `scripts/custom/<check>.cjs` returns hits: a judgment no op states |

- A shared op covers a check two contracts need; one contract's own judgment is `custom`.
- A custom check gets the file's `lines`, `prose` and front matter, may call `shape` from `lib/ops.cjs`, and returns `{ line, offending, fix }` per hit.
- A contract loads only when each template, custom check and schema it names exists, each `optional` name is in its template, and each `regex` compiles.
- A test fails on a rule no fixture makes fire, and on a custom script no rule reaches.
- A contract stays in the skill that writes the kind. Add one: copy `plugins/aidd-pm/skills/02-user-stories/scripts/`, then run `node scripts/check/engine/sync.cjs`.

## Hooks

The contract for the framework's own hooks, not for a hook a user generates with `aidd-context:08-hook-generate`. `aidd-context`, `aidd-dev`, `aidd-pm` and `aidd-telemetry` follow it; `aidd-ui` adopts it in its own change.

### Levels and moments

| Level | Effect | Mechanism | When |
| --- | --- | --- | --- |
| 0. Silent | the hook runs, nothing is sent | exit 0, no output | it only keeps a state true, such as the memory sync |
| 1. Inform | the model reads the finding and decides | `additionalContext` | the rule is certain but a deviation can be legitimate, or it has a false positive on real data |
| 2. Require | the model fixes before going on | `decision: "block"` with `reason` | the rule is certain, has no false positive on real data, and the fix is local |
| 3. Refuse | the write does not happen | the host's deny, through `refuse(reason)` | the file on disk declares itself frozen, such as a spec whose status is `locked`; never judged on the written content, whose `Edit` fragment would block drafts. Delivered on Claude Code, Codex, Copilot, Antigravity, Kiro, OpenCode (V2: write and edit only) and Kilo; inert on the others |

A check that needs judgment gets no hook: the skill's check and CI hold it.

| Moment | Event | For |
| --- | --- | --- |
| Session start | SessionStart | keeping a generated state true silently, or informing the person once, never the model (`aidd-telemetry` task reminder); the model only after a compaction |
| Before the write | PreToolUse | refusing a write to a frozen file |
| After the write | PostToolUse | an artifact final in one write: a memory file, a frontmatter |
| Turn end | Stop, once per turn | an artifact final after several writes; asks once to fix the errors on the lines the turn changed |
| Session end | none | unused: nothing is left to fix |

### Rules

| Rule | A hook must | Never | Implemented by |
| --- | --- | --- | --- |
| Owner scope | check the paths its plugin owns: `aidd-context` also the `aidd_docs/` layout, `aidd-dev` and `aidd-pm` the artifacts their contracts name | read anything else first | |
| Neutral interface | read and answer through `hooks/lib/host.cjs`, calls below | read a host's payload, except `event.raw`'s `session_id` and `transcript_path`, read by `aidd-telemetry` alone to tell Claude Code transcripts from Codex ones | `scripts/check/engine/sync.cjs` writes it from `cli/assets/hooks-runtime/host-claude.cjs`; the CLI places each host's own adapter from that folder at build time (`host-bridge.cjs` for OpenCode and Kilo) |
| Shared rules | take common checks from `hooks/lib/common-rules.cjs` | edit one copy alone | the `hook-rule-copies` check of `scripts/check/run.cjs` |
| Findings only | report the errors on the lines of `written` not in `replaced`, as a multiset, then warnings, capped at 10 | report a standing error, a missing file, or anything when clean | |
| Unknown lines | group errors by file or `<folder>/*` and inform: a shell write, an edit without `written`, a removal, a whole-file write without `replaced` | require | |
| Message format | open with `<plugin>: <n> errors, <m> warnings`, then one `<file>[:<line>] <rule> ["<excerpt>"] => <fix>` per finding | | |
| One entry per concern | run as `node ${CLAUDE_PLUGIN_ROOT}/hooks/<concern>.cjs <goal>` | add a second Stop entry: the OpenCode and Kilo bridge silences it | `memory.cjs` (`load`, `sync`, carrying the `artifacts.cjs` findings at Stop); `artifacts.cjs` (`start`, `mark`, `check`), generated from `scripts/check/engine/hook.cjs`; `aidd-telemetry`: `task.cjs remind`, `ledger.cjs ingest` |
| Node built-ins | use CommonJS and built-ins; a child process (git included) or a network call only when no built-in can, read-only, scoped, measured under the timeout on a large repository; detached when its work outlasts the bound | add a dependency | `aidd-telemetry`: the reminder spawns git, which no built-in reads (0.05 s on 4 000 commits); the ingest runs `aidd telemetry ingest` detached and writes the ledger, since transcripts must be read before the host deletes them |
| Bounded | declare a 5 s timeout and return within it; exit 0 on garbage, empty stdin or an unknown event | answer after an internal failure, or let a detached child hold the answer | |
| Turn state | keep its own per-session state; tell an error new in another file once per turn | keep state in the shared library | `artifacts.cjs`: a mark of this turn's artifacts and a reference time finding shell writes by mtime, in the temp folder; a `"shell": false` contract keeps only files a command names. `aidd-context`: a bank snapshot, checked at Stop for lines written, lines lost and sync |
| Status message | carry a short `statusMessage` naming plugin and action (`AIDD Context: sync project memory`) | | Codex shows it when asking for trust |

| Call of `hooks/lib/host.cjs` | Does |
| --- | --- |
| `readEvent()` | gives the event and its `files`, each with `path`, `written` and `replaced`, the last two absent where the host gives none, and before a tool every file carries its `path` only; a file may be deleted: tolerate `ENOENT` |
| `answer({ level, text, person })` | informs or requires; with no `text`, shows only `person`, at any event |
| `continueTurn(text, person)` | asks once at the turn end |
| `refuse(reason)` | denies the tool call about to run; does nothing on any other event or adapter |
| `hooksFolder(name, create)` | `<tmpdir>/aidd-hooks-<uid>/<name>` when it and the folder above it are this user's alone (a real directory, owned by this uid, closed to others), else null; created with mode 0700 when `create` |
| `person` argument | for the person, never the model: Claude Code and Codex show it as `systemMessage`; beside a `text`, Claude Code's `continueTurn` at Stop. OpenCode 1's bridge shows a `person` alone as a TUI toast at SessionStart (held to the session's first turn), PostToolUse and Stop, and beside a `text` at Stop; OpenCode 2's, Kilo's bridge and the other hosts ignore it |

### What the CLI carries

One descriptor and one host adapter per tool, placed at build time, and one merge engine: [CLI architecture memory](../aidd_docs/memory/internal/cli/architecture.md). What each host honours: [Compatibility](COMPATIBILITY.md).

More: [Maintainers guide](MAINTAINERS.md), [CLI architecture](../cli/ARCHITECTURE.md).
