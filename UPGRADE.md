# Upgrade guide - v3.9.1 to v4.x

> **Historical, frozen document.** This is the one-time v3 → v4 migration. If you are already on v4+, you can ignore it. It is not kept in sync with ongoing changes - for those, see [`CHANGELOG.md`](CHANGELOG.md).

This release is a full architecture rewrite. The legacy flat repo (`commands/`, `agents/`, `skills/`, `rules/`, `config/`, `dist/`) was replaced by a Claude Code **plugin marketplace** organised around skills.

If you were on `v3.x`, expect breaking changes:

- All `/command_name` slash commands are gone. Each one is now a **skill** that lives inside a plugin (for example `aidd-dev:02-implement`).
- The repo is now a **marketplace** (`.claude-plugin/marketplace.json`). You register the marketplace and install only the plugins you need. You no longer clone the whole repo into your project.
- Agents, hooks and templates moved into the plugin that owns them, not the repo root.

This guide tells you exactly what disappears, what each old command becomes, and the steps to migrate a project cleanly.

---

## 1. What changed and why

`v4` changes how the framework is delivered, not just its contents:

1. **Delivery: marketplace, not clone.** In `v3` an external CLI copied the whole repo into each project and generated per-tool copies (Claude Code, Cursor, Copilot). In `v4` you point Claude Code at the marketplace and install plugins on demand.
2. **Split into 6 plugins.** Each plugin owns one slice of the SDLC and ships its own version.
3. **Commands became skills.** Every former `/command` is a skill with structured frontmatter, references, and assets. A skill can auto-trigger from your intent or be invoked by name.
4. **Many commands were merged into routers.** Related v3 commands (the three `assert_*`, the two `review_*`, `performance` + `security_refactor`, the three debug-family commands, the five `generate_*`) collapsed into a single skill that routes to the right sub-action. See the mapping in section 4.
5. **Agents, hooks, templates moved into their owning plugin** (for example `plugins/aidd-dev/agents/`).

---

## 2. The 6 plugins

| Plugin | Purpose | Recommended |
|---|---|---|
| `aidd-context` | Project bootstrap, onboarding, memory bank, learn, mermaid, context-artifact generation, discovery. | yes |
| `aidd-dev` | The SDLC loop: plan, implement, assert, audit, review, test, refactor, debug, plus the `00-sdlc` orchestrator. Hosts the engineering agents. | yes |
| `aidd-vcs` | Commit, pull request, release tag, issue creation. | yes |
| `aidd-pm` | Ticket info, user stories, PRD, spec. | yes |
| `aidd-refine` | Brainstorm, challenge, condense, shadow-area gap analysis, fact-check. | yes |
| `aidd-orchestrator` | Async dev: turn labelled GitHub issues into PRs and iterate on review feedback. | no (opt-in) |

Each plugin ships:

- `.claude-plugin/plugin.json` (manifest + version)
- `skills/NN-action-name/SKILL.md` (one skill per former command or command family)
- `CATALOG.md` (auto-generated index of the plugin's skills)
- its own assets, agents, and references

---

## 3. Install the new way

Type these inside a Claude Code session (they are slash commands, not shell commands):

```text
/plugin marketplace add ai-driven-dev/framework
/plugin install aidd-context@aidd-framework
/plugin install aidd-dev@aidd-framework
/plugin install aidd-vcs@aidd-framework
/plugin install aidd-refine@aidd-framework
```

Install `aidd-pm` and `aidd-orchestrator` only if you use them. Each plugin is independent.

Prerequisites: a recent Claude Code that supports `/plugin marketplace add`; an Anthropic plan or `ANTHROPIC_API_KEY`; `gh` authenticated if you use the GitHub-facing plugins (`aidd-vcs`, `aidd-orchestrator`, `aidd-pm`). If the marketplace repo is private, you must have read access on the machine running Claude Code (`gh auth login` or a PAT).

### How to invoke a skill

A skill is referenced by `plugin:NN-name`, for example `aidd-dev:02-implement`. The separator inside the name is a **hyphen**, not a colon (`02-implement`, never `02:implement`). Two ways to run it:

- **Auto-trigger**: describe what you want in plain language; Claude Code routes to the matching skill.
- **Explicit**: name the skill (for example "run `aidd-dev:02-implement`").

---

## 4. Command to skill mapping (all 37 v3 commands)

Invocation in v4 is `plugin:NN-action`. Where a column says "sub-flow", the old command is now one branch of a router skill; invoke the parent skill and it routes to that branch from your input.

### onboarding and context generation

| v3 command | v4 skill |
|---|---|
| `/onboard` | `aidd-context:00-onboard` |
| `/init` | `aidd-context:02-project-init` |
| `/generate_architecture` | `aidd-context:01-bootstrap` |
| `/generate_agent` | `aidd-context:03-context-generate` (agent sub-flow) |
| `/generate_command` | `aidd-context:03-context-generate` (command sub-flow) |
| `/generate_rules` | `aidd-context:03-context-generate` (rules sub-flow) |
| `/generate_skill` | `aidd-context:03-context-generate` (skill sub-flow) - or the built-in `skill-creator` |
| `/learn` | `aidd-context:05-learn` |
| `/mermaid` | `aidd-context:04-mermaid` |

### product and refinement

| v3 command | v4 skill |
|---|---|
| `/brainstorm` | `aidd-refine:01-brainstorm` |
| `/challenge` | `aidd-refine:02-challenge` |
| `/create_user_stories` | `aidd-pm:02-user-stories-create` |
| `/ticket_info` | `aidd-pm:01-ticket-info` |

### plan

| v3 command | v4 skill |
|---|---|
| `/plan` | `aidd-dev:01-plan` |
| `/components_behavior` | `aidd-dev:01-plan` (component-behavior sub-flow) |
| `/image_extract_details` | `aidd-dev:01-plan` (image-extract sub-flow) |

### code, assert, review, test

| v3 command | v4 skill |
|---|---|
| `/implement` | `aidd-dev:02-implement` |
| `/assert` | `aidd-dev:03-assert` |
| `/assert_architecture` | `aidd-dev:03-assert` (architecture sub-flow) |
| `/assert_frontend` | `aidd-dev:03-assert` (frontend sub-flow) |
| `/review_code` | `aidd-dev:05-review` (code sub-flow) |
| `/review_functional` | `aidd-dev:05-review` (functional sub-flow) |
| `/test` | `aidd-dev:06-test` |
| `/test_journey` | `aidd-dev:06-test` (journey sub-flow) |

### refactor, audit, debug

| v3 command | v4 skill |
|---|---|
| `/audit` | `aidd-dev:04-audit` |
| `/performance` | `aidd-dev:07-refactor` (performance axis) |
| `/security_refactor` | `aidd-dev:07-refactor` (security axis) |
| `/debug` | `aidd-dev:08-debug` |
| `/reflect_issue` | `aidd-dev:08-debug` (reflect/hypothesis sub-flow) |
| `/reproduce` | `aidd-dev:08-debug` (test-driven reproduce sub-flow) |

### vcs and issues

| v3 command | v4 skill |
|---|---|
| `/commit` | `aidd-vcs:01-commit` |
| `/create_request` | `aidd-vcs:02-pull-request` |
| `/tag` | `aidd-vcs:03-release-tag` |
| `/new_issue` | `aidd-vcs:04-issue-create` |

### Removed (no direct replacement)

| v3 command | What to do instead |
|---|---|
| `/auto_accept` | Removed. Auto-accept is now a Claude Code setting, not a framework command. |
| `/implement_from_design` | Removed. Pass the design image to `aidd-dev:02-implement`. For dedicated frontend work use the `impeccable` skill if installed. |
| `/run_projection` | Removed. Projection is now part of the `aidd-dev:01-plan` / `aidd-dev:02-implement` loop. |

### New in v4 (no v3 equivalent)

| v4 skill | What it does | Added in |
|---|---|---|
| `aidd-context:06-discovery` | Enumerates installed skills, agents, rules, hooks, memory and recommends a match. | 4.0 |
| `aidd-dev:00-sdlc` | Orchestrates the full plan to ship loop (auto or interactive). | 4.0 |
| `aidd-dev:09-for-sure` | Loops and retries a task until an explicit success condition is met. | 4.0 |
| `aidd-orchestrator:00-async-dev` | Async, label/comment-driven runs from GitHub issues (setup / run / review). | 4.0 |
| `aidd-pm:03-prd` | Builds a PRD from a feature description or user stories. | 4.0 |
| `aidd-pm:04-spec` | Writes a normalised tech spec (the contract planning consumes). | 4.0 |
| `aidd-refine:03-condense` | Terse output mode with token-savings reporting. | 4.0 |
| `aidd-refine:04-shadow-areas` | Scans a spec for blind spots (missing actor, edge case, dependency, ...). | 4.0 |
| `aidd-refine:05-fact-check` | Verifies factual claims against sources and rewrites with citations. | 4.1 |

---

## 5. Step-by-step migration of an existing project

1. **Back up your v3 customisations.** Note any commands you added yourself under `commands/`. They do not migrate automatically.
2. **Delete the legacy framework folders** that the v3 CLI copied into your project: `commands/`, and any framework-managed `agents/`, `config/` copies. Your project's own `aidd_docs/` (memory, templates, tasks) stays. The memory bank format is unchanged.
3. **Add the marketplace and install plugins** (section 3). Most users start with `aidd-context` + `aidd-dev` + `aidd-vcs` + `aidd-refine`.
4. **Re-wire the project.** Run `aidd-context:02-project-init` to set up the new layout in `.claude/` and ensure the project memory block is present in your AI context files. Run `aidd-context:00-onboard` if you want a guided walkthrough of what to do next.
5. **Translate each custom command into a skill.** Use the built-in `skill-creator` (or `aidd-context:03-context-generate`), put the result in your own local plugin, and load it through `.claude/settings.json`.
6. **Update CI and scripts.** Anywhere CI called `/some_command`, switch to the new skill (auto-trigger by intent, or name `plugin:NN-action`). For `aidd-orchestrator`, see section 7.
7. **Verify.** Run `aidd-context:06-discovery` to confirm the installed skills, agents, rules and hooks match what you expect.

---

## 6. FAQ

**Will v3 keep working?** Yes, but it is no longer maintained. Pin to `v3.9.1` if you cannot migrate yet.

**Do I need all 6 plugins?** No. Each is independent. Install only what you use; a common starting set is `aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-refine`.

**Where did my custom hooks go?** Framework hooks now live in the plugin that owns them, under `plugins/<plugin>/hooks/`. Your own project hooks stay in your project.

**Where did the agents go?** Into the owning plugin, for example `plugins/aidd-dev/agents/` (implementer, planner, reviewer).

**I had `aidd_docs/memory/`. Is it still used?** Yes. The format is unchanged. The skills that read it moved into `aidd-context`.

**The old invocation used `:` between number and name. Is that still valid?** No. The skill name uses a hyphen: `aidd-dev:02-implement`, not `aidd-dev:02:implement`. The colon form can silently fail on non-Claude hosts.

**How do I get help?** Open an issue: <https://github.com/ai-driven-dev/framework/issues>.


---

For the raw list of every change, see [`CHANGELOG.md`](CHANGELOG.md).
