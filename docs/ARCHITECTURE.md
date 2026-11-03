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

### Layer boundaries

| Layer | Boundary |
| --- | --- |
| Knowledge | Produces context and specifications; never writes or runs application source. Context bootstrap creates no `package.json`. |
| Execution | Changes or validates application source. |
| External | Owns version control. |
| Coordination | Sequences artifacts (for example `INSTALL.md`). Domain logic and artifact contracts stay with their owners; direct and orchestrated calls obey the same contracts. |
| Observation | Records work without changing observed artifacts. Productive flows never depend on it. |

### Measurement boundary

`aidd-telemetry` counts the tokens of Claude Code and Codex sessions deterministically and attributes them to the task a person declared. The CLI reads, stores, attributes and reports; the plugin's hooks only ask, answer and record session facts. The contract is [`aidd_docs/product/usage-contract.md`](../aidd_docs/product/usage-contract.md).

## Execution model

### Skills and actions

```mermaid
flowchart TB
  User["User"] --> Router["Orchestrator SKILL.md"]
  Router --> Protocol["Orchestration protocol"]
  User -->|direct invocation| Recipe["Recipe SKILL.md"]
  Protocol -->|discover and invoke provider| Recipe
  Protocol -->|authorized isolation| Agent["Agent"]
  Agent -->|declared recipes only| Recipe
  Recipe --> Action["Self-contained action"]
  Action --> Result["Result or artifact"]
```

### Agents and delegation

| Role | Contract |
| --- | --- |
| Skill | Host loads `SKILL.md` on invocation; work runs in the caller's context. |
| Orchestrator | Owns routing; authorizes isolation or bounded fan-out. |
| Agent | Isolates work and returns a result. Invokes declared canonical recipe skills; an approved generated-skill trial may read and execute only the designated skill. Never invokes orchestrators. |
| Recipe | May delegate a generated-skill trial with explicit user approval from the main context. An isolated recipe returns the proposal to its caller without spawning. |
| Reconnaissance helper | Read-only; neither mutates nor spawns. |
| Write path | At most two delegation layers; no cycles. |
| SDLC | Owns planning; [delivery](../plugins/aidd-orchestrator/skills/01-sdlc/references/02-deliver.md) and [check](../plugins/aidd-orchestrator/skills/01-sdlc/references/03-check.md) govern execution, leaf executors, independent judgment and bounded repair. |

### 🪝 Bundled hooks

Dependency-free Node scripts declared in `hooks/hooks.json`; `node` must be on `PATH`.

| Plugin           | Event                                   | Runs                     | Purpose                                                     |
| ---------------- | --------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `aidd-context`   | `SessionStart`                          | `hooks/update_memory.js` | Refresh the project memory block in the AI context files    |
| `aidd-telemetry` | `SessionStart` · `UserPromptSubmit`     | `hooks/session-start.cjs` · `hooks/catch-up.cjs` · `hooks/prompt-gate.cjs` | At session start, record which session a process is on and keep its task across `/clear`, and catch the ledger up (async); on a prompt, hold it on an undeclared branch until a task is declared, and answer the declaration without the model |

## Portability

| Surface | Contract | Reference |
| --- | --- | --- |
| CLI output | Supported target capabilities only; `aidd translate` warns and skips rules and commands. | [Output layouts](../cli/README.md#translate) |
| Skills | Links stay inside the skill directory. Flat distribution renames skills `<plugin>-<skill>`; marketplace installation preserves the tree. | [Portability guard](../scripts/__tests__/a-skill-links-only-inside-itself.test.js) |
| Bundled scripts | Named plugin-relative in backticks, never linked. | [Portability guard](../scripts/__tests__/a-skill-links-only-inside-itself.test.js) |
| Hook adapters | CLI owns OpenCode's shared host protocol; plugins own payload mapping. | [Delivery and compatibility](../cli/ARCHITECTURE.md#hook-adaptation) |

## Capability discovery and addressing

| Context | Rule |
| --- | --- |
| Dispatch tables (`## Actions`), orchestration references and agent permissions (`# Skills you may invoke`) | Canonical `/plugin:folder` or `@plugin:agent` addresses. Elsewhere, name the responsibility. |
| Cross-plugin providers | Recipes discover by description rather than hardcoding siblings; orchestrators verify installation before dispatch. |
| Backlog flow | Owned by `aidd-orchestrator:02-backlog`. |
| Orthogonality exceptions | `isExemptFromOrthogonality` permits responsibility maps in `plugins/aidd-orchestrator/**` and onboarding menus in `plugins/aidd-context/skills/00-onboard/**`. The onboarding exemption ends with runtime provider discovery. |

## References

| Document | Question answered |
| --- | --- |
| [Framework README](../README.md) | What can I use, and how do I start? |
| [Marketplace guide](MARKETPLACE.md) | How do registration, scopes and updates work? |
| [Create a plugin](CREATE_PLUGIN.md) | How do I author and publish a plugin? |
| [Glossary](GLOSSARY.md) | What do the terms mean? |
| [CLI reference](../cli/README.md) | Which commands and output layouts are supported? |
| [CLI architecture](../cli/ARCHITECTURE.md) | How are translation and installation implemented? |
| [Contributing](../CONTRIBUTING.md) | How do I contribute to this repository? |
| [Maintainers guide](MAINTAINERS.md) | How are repository operations and releases managed? |
| [Claude plugin reference](https://code.claude.com/docs/en/plugins-reference) | How do native plugin components behave? |
