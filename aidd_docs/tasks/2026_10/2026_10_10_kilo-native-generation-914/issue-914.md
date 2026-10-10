# Issue #914

Source : https://github.com/ai-driven-dev/framework/issues/914

Snapshot received 2026-10-10; updated_at: 2026-10-10T09:45:34Z

> Summary: Make every applicable aidd-context workflow detect Kilo and emit artifacts through Kilo's documented native or config-backed surfaces, without overwriting user-owned context or inventing unsupported declarative hooks.

## Outcome

A Kilo-only project can onboard AIDD, wire project memory, and generate rules, skills, agents, and workflows that Kilo discovers without manual file moves or configuration repair.

## Problem

The CLI supports Kilo through #744, but aidd-context still omits Kilo from onboarding, project-memory wiring, and the skill, rule, agent, command, and hook generation contracts.

A Kilo-only project is therefore proposed inconsistently. Some generators lack a Kilo target; others do not document the configuration required to make the generated artifact discoverable.

## Official Kilo contract

Verified on 2026-09-25.

- Project memory: AGENTS.md at the project root is loaded automatically. AGENT.md is a fallback, and per-directory AGENTS.md files are loaded when Kilo reads files beneath them:
  https://kilo.ai/docs/customize/agents-md
- Rules: Markdown files such as .kilo/rules/<name>.md are loaded through the instructions array in project configuration. Entry order is significant:
  https://kilo.ai/docs/customize/custom-rules
- Skills: Kilo implements Agent Skills and discovers project skills from .kilo/skills/ and compatibility locations including .agents/skills/:
  https://kilo.ai/docs/customize/skills
- Agents: project Markdown agents live under .kilo/agents/. The filename defines the name; YAML frontmatter can define description, mode, model, temperature, and permissions:
  https://kilo.ai/docs/customize/custom-subagents
- Workflows: project workflows are Markdown slash commands under .kilo/commands/:
  https://kilo.ai/docs/customize/workflows
- Plugins and hooks: JavaScript or TypeScript modules live under .kilo/plugin/ or .kilo/plugins/ and expose typed hooks or the event bus, including session.created:
  https://kilo.ai/docs/automate/extending/plugins
- Project configuration: Kilo reads kilo.json and kilo.jsonc at the project root or under .kilo/. The .kilo/ form has higher priority, and loaded configurations are deep-merged:
  https://kilo.ai/docs/getting-started/settings
- Legacy compatibility: .kilocode/ remains a recognized fallback, while .kilo/ is canonical for new artifacts:
  https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md

## Detection and configuration decision

Detect Kilo from these unambiguous signals:

- .kilo/
- .kilocode/ as a legacy detection signal only
- kilo.json or kilo.jsonc at the project root
- .kilo/kilo.json or .kilo/kilo.jsonc

Do not detect Kilo from opencode.json[c] alone because that signal is shared with OpenCode legacy compatibility.

Generate all new Kilo-specific artifacts under canonical .kilo/ paths. Never generate new artifacts under .kilocode/.

When a generator must update instructions:

1. If no project Kilo config exists, create .kilo/kilo.jsonc.
2. If exactly one project Kilo config exists, update it.
3. If several project configs exist and one already owns the AIDD instruction entry, update that file idempotently.
4. Otherwise present the existing candidates in Kilo precedence order and let the user choose which file to edit.
5. Preserve every existing instructions entry, duplicate, order, JSONC comment, trailing comma, and unrelated formatting.
6. If a safe edit cannot be made, stop before writing and return an actionable error.

Kilo deep-merges supported config files. Do not silently inherit the CLI's stricter dual-config refusal as if it were a Kilo runtime constraint.

## Generation targets

### Onboarding and project memory

- Propose Kilo when any canonical or legacy Kilo signal is detected.
- Treat root AGENTS.md as Kilo's primary project-memory surface.
- Preserve user-authored content and update only the AIDD-owned memory block.
- Deduplicate AGENTS.md when another selected tool shares the same target.

### Rules

- Write .kilo/rules/<category>/<slug>.md.
- Add that exact relative path to the selected config's instructions array.
- Describe the directory as config-backed, not auto-discovered.
- Preserve instruction order because Kilo loads entries in declared order.

### Skills

- Generate Agent Skills format with a SKILL.md whose name matches its parent directory.
- Use .kilo/skills/<name>/ for a Kilo-only target.
- Offer .agents/skills/<name>/ only when the user explicitly selects a portable shared target.
- Never duplicate one skill into both locations during the same generation.

### Agents

- Write .kilo/agents/<name>.md.
- Use the filename as the agent name.
- Emit documented YAML frontmatter with description and mode: subagent; preserve supported optional model, temperature, and permission fields when requested.

### Workflows

- Write .kilo/commands/<name>.md.
- Preserve documented optional frontmatter such as description, agent, model, variant, and subtask.

### Hooks

- Do not emit Claude-style declarative hooks for Kilo.
- Explain that Kilo uses JavaScript or TypeScript plugins under .kilo/plugin/ or .kilo/plugins/.
- Name the documented event or typed hook that corresponds to the requested lifecycle only when the mapping is proven.
- Do not invent mappings for unsupported Claude hook events.
- Generic runtime plugin implementation remains out of scope. The existing CLI bridge may be referenced only for its captured session.created mapping.

## Acceptance criteria

- [ ] A Kilo-only fixture is detected by onboarding and every applicable generator.
- [ ] Detection covers .kilo/, root kilo.json[c], .kilo/kilo.json[c], and legacy .kilocode/.
- [ ] Legacy .kilocode/ detection still produces new artifacts under canonical .kilo/ paths.
- [ ] opencode.json[c] alone does not produce a false Kilo detection.
- [ ] AGENTS.md generation preserves user content and deduplicates a shared target.
- [ ] Rule generation writes .kilo/rules/<category>/<slug>.md and wires the exact path through instructions.
- [ ] Config selection respects Kilo's precedence and asks before choosing among ambiguous existing files.
- [ ] JSON and JSONC updates preserve existing entries, duplicates, order, comments, trailing commas, and unrelated formatting.
- [ ] Skill placement requires an explicit choice before using .agents/skills/.
- [ ] Agent paths and frontmatter match the documented Markdown-agent contract.
- [ ] Workflows are generated under .kilo/commands/ with supported frontmatter only.
- [ ] Hook generation returns precise plugin guidance and never emits an unsupported declarative hook.
- [ ] Re-running every generator is idempotent.
- [ ] Invalid or unsafe configuration causes no partial write.
- [ ] Runtime-oriented tests prove Kilo discovers each emitted artifact on supported platforms.
- [ ] Every Kilo path claim carries an official source and the 2026-09-25 verification date.

## Repository evidence

- CLI Kilo profile: cli/src/contexts/tools/domain/profiles/kilo/profile.ts
- Current config resolver: cli/src/contexts/tools/domain/profiles/kilo/kilo-paths.ts
- Existing captured SessionStart bridge: cli/src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts
- aidd-context generators: plugins/aidd-context/skills/02-project-init and 04-skill-generate through 08-hook-generate

## Relations and boundaries

- #744 delivered the CLI Kilo profile.
- #868 owns Kilo flat rule distribution.
- #790 remains closed; this issue does not restore a generic session-start bridge.
- Supersedes the Kilo portion of #788.
- Flat archive emission, arbitrary hook conversion, and runtime plugin implementation are out of scope.


## Comments

https://github.com/ai-driven-dev/framework/issues/914#issuecomment-6096252579

Hi @blafourcade,

I'd like to start working on this issue.

I'll follow the defined scope and acceptance criteria.

I'll work on a dedicated branch targeting next.

Thanks!
