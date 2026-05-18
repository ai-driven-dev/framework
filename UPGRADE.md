# Upgrade guide — v3.9.1 → v4.0.0

This release ships a full architecture rewrite. The legacy `commands/` directory was deleted and replaced with a Claude Code plugin marketplace organised around skills.

If you were on `v3.x`, plan for breaking changes:

- All `/command_name` slash commands are gone. They are now skills invoked via plugins (e.g. `/aidd-dev:02:implement`).
- The repo is now a plugin **marketplace** (`.claude-plugin/marketplace.json`). You install the plugins you want; you do not clone the whole repo into your project.
- Hooks, agents and templates moved into skill assets inside each plugin.

---

## 1. Why the major bump

`v4.0.0` is a structural rewrite of how the framework is delivered:

1. **The framework is now a Claude Code marketplace.** Instead of cloning the whole repo, you point Claude Code at the marketplace and install plugins on demand.
2. **The framework is split into 6 plugins.** Each plugin owns a slice of the SDLC (`aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-pm`, `aidd-orchestrator`, `aidd-refine`) and ships independently.
3. **Skills replace commands.** Every former `/command` is now a skill with structured frontmatter, evals, and assets. Skills can be invoked explicitly or auto-triggered by Claude Code.
4. **Hooks, agents and templates moved into the plugins that own them**, not at the repo root.

---

## 2. New plugin layout

| Plugin | Purpose |
|---|---|
| `aidd-context` | Project bootstrap, onboarding, memory, learning, mermaid. |
| `aidd-dev` | Plan → implement → assert → review → test → refactor → debug SDLC loop. |
| `aidd-vcs` | Commit, pull request, release tag, issue creation. |
| `aidd-pm` | Ticket info, user stories, PRD, spec. |
| `aidd-orchestrator` | Async dev orchestration (label/comment-driven Claude runs). |
| `aidd-refine` | Brainstorm, challenge, condense, shadow-area gap analysis. |

Each plugin ships its own:
- `.claude-plugin/plugin.json` (manifest + version)
- `skills/NN-action-name/SKILL.md` (one skill per former command)
- `CATALOG.md` (auto-generated index)
- assets, agents, references, evals

---

## 3. Install (new flow)

```bash
# Add the marketplace once
claude marketplace add https://github.com/ai-driven-dev/aidd-framework

# Install only what you need
claude plugin install aidd-context@aidd-framework
claude plugin install aidd-dev@aidd-framework
claude plugin install aidd-vcs@aidd-framework
claude plugin install aidd-refine@aidd-framework
# … etc.
```

---

## 4. Command → skill mapping

Drop-in mapping from `v3.9.1` commands to `v4.0.0` skills. Invocation syntax is `/<plugin>:<NN-action>` in Claude Code.

### Removed (no direct replacement)

| v3 command | Status |
|---|---|
| `/auto_accept` | Removed — controlled via Claude Code settings now. |
| `/implement_from_design` | Removed — covered by `aidd-dev:02:implement` with image input. |
| `/run_projection` | Removed — projection is now part of the plan/implement loop. |
| `/aidd-dev:08:debug` | Removed — folded into `aidd-dev:08:debug`. |
| `/aidd-dev:08:debug` | Removed — folded into `aidd-dev:08:debug`. |

### Renamed / relocated

| v3 command | v4 skill |
|---|---|
| `/onboard` | `/aidd-context:00:onboard` |
| `/init` | `/aidd-context:02:project-init` |
| `/aidd-context:05:learn` | `/aidd-context:05:learn` |
| `/aidd-context:04:mermaid` | `/aidd-context:04:mermaid` |
| `/aidd-context:03:context-generate` | `/aidd-context:*` (generators folded into context skills) |
| `/generate_architecture` | `/aidd-context:01:bootstrap` |
| `/aidd-context:03:context-generate` | `/aidd-context:*` |
| `/aidd-context:03:context-generate` | `/aidd-context:*` |
| `/aidd-context:03:context-generate` | `/aidd-context:*` (also covered by Claude Code's built-in `skill-creator`) |
| `/aidd-refine:01:brainstorm` | `/aidd-refine:01:brainstorm` |
| `/aidd-refine:02:challenge` | `/aidd-refine:02:challenge` |
| `/aidd-pm:02:user-stories-create` | `/aidd-pm:02:user-stories-create` |
| `/aidd-pm:01:ticket-info` | `/aidd-pm:01:ticket-info` |
| `/aidd-dev:01:plan` | `/aidd-dev:01:plan` |
| `/components_behavior` | `/aidd-dev:01:plan` (sub-flow) |
| `/aidd-dev:01:plan` | `/aidd-dev:01:plan` (sub-flow) |
| `/aidd-dev:02:implement` | `/aidd-dev:02:implement` |
| `/aidd-dev:03:assert` | `/aidd-dev:03:assert` |
| `/aidd-dev:03:assert` | `/aidd-dev:03:assert` (sub-flow) |
| `/aidd-dev:03:assert` | `/aidd-dev:03:assert` (sub-flow) |
| `/aidd-dev:05:review` | `/aidd-dev:05:review` |
| `/aidd-dev:05:review` | `/aidd-dev:05:review` |
| `/aidd-dev:06:test` | `/aidd-dev:06:test` |
| `/aidd-dev:06:test` | `/aidd-dev:06:test` (journey sub-flow) |
| `/aidd-dev:04:audit` | `/aidd-dev:04:audit` |
| `/performance` | `/aidd-dev:07:refactor` |
| `/security_refactor` | `/aidd-dev:07:refactor` |
| `/aidd-dev:08:debug` | `/aidd-dev:08:debug` |
| `/aidd-vcs:01:commit` | `/aidd-vcs:01:commit` |
| `/aidd-vcs:02:pull-request` | `/aidd-vcs:02:pull-request` |
| `/aidd-vcs:03:release-tag` | `/aidd-vcs:03:release-tag` |
| `/aidd-vcs:04:issue-create` | `/aidd-vcs:04:issue-create` |

### New in v4 (no v3 equivalent)

| v4 skill | What it does |
|---|---|
| `/aidd-context:01:bootstrap` | Imagines a SaaS architecture from scratch. |
| `/aidd-context:06:discovery` | Finds rules, hooks, memory across the project. |
| `/aidd-dev:00:sdlc` | Orchestrates the full plan → ship loop interactively. |
| `/aidd-dev:09:for-sure` | Validates assumptions before commit. |
| `/aidd-orchestrator:*` | Async, label-driven Claude runs from GitHub issues. |
| `/aidd-pm:03:prd` | Builds PRD from requirements. |
| `/aidd-pm:04:spec` | Writes tech spec. |
| `/aidd-refine:03:condense` | Shrinks long docs without losing intent. |
| `/aidd-refine:04:shadow-areas` | Detects blind spots in feature specs. |

---

## 5. Step-by-step migration

1. **Backup your v3 setup.** Note any custom commands you added under `commands/` — they will not migrate automatically.
2. **Delete the legacy `commands/` directory** from your project. That is the only folder that disappears: `aidd_docs/memory/` and any other project files stay as-is.
3. **Add the marketplace** (see §3).
4. **Install the plugins you use.** Most users start with `aidd-context` + `aidd-dev` + `aidd-vcs` + `aidd-refine`.
5. **Re-bootstrap the project.** Run `/aidd-context:02:project-init` to wire the new plugin layout into `.claude/`. Use `/aidd-context:00:onboard` only when you want a guided walkthrough.
6. **Translate your custom commands.** For each custom command you had under `commands/`, generate a skill (e.g. via the built-in `skill-creator`), place it in your own local plugin, and load it via `.claude/settings.json`.
7. **Update CI references.** If your CI invoked `/some_command`, switch to the new skill invocation.

---

## 6. FAQ

**Q. Will `v3` keep working?**
Yes, but it is no longer maintained. Pin to `v3.9.1` if you cannot migrate yet.

**Q. Do I need all 6 plugins?**
No. Each plugin is independent. Install only what you use.

**Q. Where did my custom hooks go?**
Hooks were split into the plugins that own them. Look under `plugins/<plugin>/hooks/` in the source, or read each plugin's `CATALOG.md`.

**Q. Where did the agents go?**
Agents now live inside the plugin that uses them (e.g. `plugins/aidd-dev/agents/`).

**Q. I had `aidd_docs/memory/`. Is it still used?**
Yes. The memory bank format is unchanged. The skills that read it just moved into `aidd-context`.

**Q. How do I get help?**
Open an issue: <https://github.com/ai-driven-dev/aidd-framework/issues>.

---

## Appendix: aidd-orchestrator v4 → v4.1

The four async-dev skills collapsed into a single router-based skill, mirroring the `aidd-context:03-context-generate` pattern.

**Skill name changes:**

| Before                                | After                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| `aidd-orchestrator:01:setup-async-dev` | `aidd-orchestrator:00:async-dev` with `action=setup`           |
| `aidd-orchestrator:02:run-async-dev`   | `aidd-orchestrator:00:async-dev` with `action=run`             |
| `aidd-orchestrator:03:review-async-dev`| `aidd-orchestrator:00:async-dev` with `action=review`          |

**What also changed:**

- Actions moved into `actions/{setup,run,review}/` sub-domains under the single skill.
- Assets and references regrouped under `assets/setup/` and `references/{setup,review}/`.
- Hybrid invocation: `$ARGUMENTS` keyword > trigger env (label / comment) > repo state > natural intent. See `plugins/aidd-orchestrator/skills/00-async-dev/references/routing.md`.
- The bundled `.github/workflows/aidd-async.yml` template (and the framework's own workflow) were updated to pass `action=` keywords.

**Action for users**: update any external invocation of `:01`, `:02`, or `:03` skill names to the new router with an explicit `action=` keyword, or rely on auto-detection.

---

For the raw list of every change, see [`CHANGELOG.md`](CHANGELOG.md).
