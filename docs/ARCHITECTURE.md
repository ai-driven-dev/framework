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

## Hooks

The contract for the framework's own hooks, not for a hook a user generates with `aidd-context:08-hook-generate`. `aidd-context` follows it; `aidd-ui` adopts it in its own change. `aidd-telemetry` stays outside.

A hook checks mechanical rules only; a rule that needs judgment belongs to the skill's check and to CI.

### Levels and moments

A level is what a finding demands; a moment is when the artifact is final.

| Level | Effect | Mechanism | Used when |
| --- | --- | --- | --- |
| 1. Inform | the model reads the finding and decides | `additionalContext` | the rule is certain but a deviation can be legitimate |
| 2. Require | the model must fix before going on | `decision: "block"` with `reason` | the rule is certain, has no false positive on real data, and the fix is local |

| Moment | Event | For |
| --- | --- | --- |
| After the write | PostToolUse | an artifact final in one write: a memory file, a frontmatter |
| At the turn end | Stop, once per turn | an artifact final only after several writes; asks once to fix the errors on the lines the turn changed |

SessionStart keeps a generated state true, silently. No level stops a write: PreToolUse sees an `Edit` fragment and would block drafts.

Placing a gap: judgment needed, no hook; one write, after the write, several, at the turn end; any false positive on real data, level 1.

### Rules

1. **Owner scope.** A hook checks the paths its plugin owns and exits before reading anything else. `aidd-context` also owns the layout of `aidd_docs/`.
2. **One neutral interface.** A hook reads and answers through `hooks/lib/host.cjs`, never a host's payload. `readEvent()` returns the event with its `files` (each with `written`, the text put in the file, and `replaced`, the text it replaced, either absent where the host gives none); `answer({ level, text })` informs or requires, `continueTurn(text)` asks once. A `files` entry may name a deleted file: tolerate `ENOENT`. Shared rules live in `hooks/lib/common-rules.cjs`; copies are held identical by `scripts/check-hook-rule-copies.js`.
3. **Findings only.** Report what this write or turn produced, never standing errors: every error on the whole lines of `written` not in `replaced`, counted as a multiset, one line each. When those lines are unknown (a shell write, an edit without `written`, a write that only removed lines), a file's errors are grouped under its name, or under `<folder>/*` across several files, and only inform. A whole-file write without `replaced` counts every line as written, informs only and is never required. Never a missing file; an error in another file is rule 7's. Warnings follow, capped at 10. Silent when clean. Format:

   ```
   <plugin>: <n> errors, <m> warnings
   <file>[:<line>] <rule> ["<excerpt>"] => <fix>
   ```
4. **One entry per concern.** `node ${CLAUDE_PLUGIN_ROOT}/hooks/<concern>.cjs hook|check|sync`: the same file runs by hand, from a skill and in CI.
5. **Node built-ins; anything heavier is justified and measured.** CommonJS, `fs`, `path`, `os`, no dependency. A child process, git included, or a network call runs on every write or turn end it hooks: use one only when no built-in can do the job, keep it read-only and scoped to what the hook guards, and measure it under the hook's timeout on a large repository before it ships.
6. **Bounded.** A 5 s declared timeout. Exit 0 on garbage, empty stdin or an unknown event; an internal failure answers nothing.
7. **Turn state is the plugin's own.** A plugin with a Stop check keeps its own per-session state, and may tell an error new in another file once per turn; the shared library holds none. `aidd-context` keeps none: a format finding informs after the write, and its Stop check compares the bank to HEAD, so it needs no state of its own.
8. **Status message.** Every handler carries a short `statusMessage` naming its plugin and action (`AIDD Context: check memory file`); Codex shows it when asking for trust.

### What the CLI carries

One descriptor and one host adapter per tool, placed at build time, and one merge engine: [CLI architecture bank](../cli/aidd_docs/memory/architecture.md).

More: [Maintainers guide](MAINTAINERS.md), [CLI architecture](../cli/ARCHITECTURE.md).
