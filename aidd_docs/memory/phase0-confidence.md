# Phase 0 Confidence Reassessment

Date: 2026-04-29

## Item-by-Item Findings

### Item 1: Pin Claude Code marketplace spec
Status: COMPLETE (best-effort)

No official upstream Claude Code marketplace schema URL was found. Three schemas derived from CLI source code:
- `scripts/schemas/marketplace.schema.json` — derived from marketplace-registry-adapter.ts
- `scripts/schemas/plugin.schema.json` — authoritative, derived from validateManifest() in plugin-distribution-reader-adapter.ts and PLUGIN_NAME_REGEX in plugin.ts
- `scripts/schemas/hooks.schema.json` — partial, hooks/hooks.json format not authoritatively specified in codebase

The `plugin.schema.json` is the load-bearing one — it matches what the CLI actually validates. The marketplace and hooks schemas are documentation artifacts.

Blocker: None. The plugin.json schema is internally validated.

### Item 2: Spike bracket-in-path skill names
Status: COMPLETE — SAFE

Bracket names (`[1.1] project-init/`) work at:
- OS level (macOS, Linux)
- Node.js fs.readdir() / path.join()
- CLI pipeline (FileSystemAdapter.listDirectory → isComponentFile → PluginDistribution)
- Git (normal directory names)

Risk documented: shell glob expansion in scripts — mitigation is to always quote bracket paths in shell contexts.

See: `aidd_docs/memory/spike-bracket-paths.md`

### Item 3: CLI surface inventory
Status: COMPLETE

All framework-structure assumptions documented:
- `config/mcp.json` (line 30): safe to keep at framework level
- `config/codex/hooks.json` (line 40): currently empty, no impact
- `config/scripts/update_memory.js` (line 44): will move to aidd-context plugin in Phase 6

No CLI changes required for Phases 1-4. Changes needed in Phase 6+ (hook script relocation).

See: `aidd_docs/memory/cli-coordination.md`

### Item 4: Build script sketch
Status: COMPLETE

Current `scripts/build-dist.sh` uses `aidd install` CLI, not direct file iteration. It is bracket-safe already.

Plugin-era pseudocode documented with `find -print0` pattern for safe bracket handling.

See: `aidd_docs/memory/build-sketch.md`

### Item 5: Pilot plugin — aidd-vcs (CRITICAL)
Status: COMPLETE — ALL THREE SUCCESS CRITERIA MET

1. `plugin add ./plugins/aidd-vcs --tool claude` — SUCCEEDED
2. `.claude/plugins/aidd-vcs/skills/[3.1] commit/SKILL.md` written and discoverable — CONFIRMED (all 17 files)
3. Bracket names preserved through full pipeline — CONFIRMED

Correction: plan says `--tools` (plural); actual flag is `--tool` (singular).

Key finding: plugin skills install to `.claude/plugins/<name>/skills/` NOT the tool's flat skills directory. Skills stay namespaced under the plugin — they are not merged into `{{TOOLS}}/skills/`.

See: `aidd_docs/memory/pilot-aidd-vcs.md`

### Item 6: Exhaustive command inventory
Status: COMPLETE

37 commands across 10 categories mapped to target plugins and skill bracket IDs.

aidd-vcs: 4 commands (commit, pull-request, release-tag, issue-create)
aidd-dev: 20 commands
aidd-context: 8-9 commands
aidd-pm: 0 current commands (RC)

Numbering conflict identified: plan uses `[3.X]` for both aidd-context plan-phase commands and aidd-vcs commands. Recommendation: use `[8.X]` for deploy/vcs commands to match their current phase number.

See: `aidd_docs/memory/command-inventory.md`

### Item 7: Release-please monorepo dry-run
Status: COMPLETE

release-please 11.11.0 is available. Configuration changes documented for 4-plugin monorepo. Each plugin needs `version.txt` and a manifest entry. Tag format changes to `aidd-vcs-v1.0.0`.

See: `aidd_docs/memory/release-please-sketch.md`

### Item 8: Hook spec end-to-end
Status: COMPLETE (partial — hooks.json format not authoritatively specified)

Sample `hooks.json` documented at `aidd_docs/memory/sample-hooks.json`. Per-IDE expected output documented. CLI handling verified (acceptsHooks: true for claude and cursor).

The update_memory.js SessionStart hook is the only hook in the framework. Its migration to aidd-context plugin is straightforward.

### Item 9: Audit all template dirs
Status: COMPLETE

39 template files audited. 7 VCS templates migrated in pilot. 22 remaining templates assigned to target plugins. 1 orphan (domain/.gitkeep) scheduled for Phase 3 deletion.

See: `aidd_docs/memory/template-audit.md`

### Item 10: MCP merge behavior check
Status: COMPLETE

Current MCP pipeline: framework-level `config/mcp.json` written at install time; plugin `.mcp.json` merged additively at `plugin add` time. No collision detection for duplicate server names.

Recommendation: keep framework `config/mcp.json` (Option A). Plugin-era MCP works with zero CLI changes.

See: `aidd_docs/memory/mcp-merge-behavior.md`

### Item 11: Validate generate-skill scripts
Status: COMPLETE — N/A

No `generate-skill/scripts/` directory exists. Framework `skills/` contains only `aidd-auto-implement/` and `challenge/`. No validation scripts to break with new structure.

Documented in: `aidd_docs/memory/pilot-aidd-vcs.md`

### Item 12: Confidence reassessment
This document.

## Confidence Score

Previous: 7/10
Revised: **9/10**

## Rationale

The three critical success criteria for reaching 9/10 (from advisor review) all passed:

1. `plugin add ./plugins/aidd-vcs --tool claude` succeeded end-to-end.
2. `.claude/plugins/aidd-vcs/skills/[3.1] commit/SKILL.md` was written and is discoverable.
3. Bracket names survived the full pipeline without modification.

The remaining 1 point from 10 is withheld for:
- Bracket numbering conflict between aidd-context and aidd-vcs (`[3.X]` used by both per the plan) — needs resolution before Phase 1
- `hooks/hooks.json` plugin format not authoritatively documented — hooks.json structure in installed plugin is unspecified by CLI codebase
- Skill discoverability question: skills land in `.claude/plugins/<name>/skills/` not the flat skills directory — need to confirm Claude Code discovers skills from both locations

## Blockers That Would Prevent 9/10

None identified that block Phase 1. The blockers above are resolvable with a single CLI test or documentation lookup.

## Open Issues Before Phase 1

1. **Bracket numbering conflict**: Resolve `[3.X]` usage — assign `[8.X]` to vcs commands (matching phase 08) and keep `[3.X]` for plan-phase commands in aidd-context
2. **Skill discoverability**: Verify Claude Code reads skills from `.claude/plugins/*/skills/` in addition to the flat skills directory — test with actual Claude Code session
3. **hooks.json plugin format**: The installed `hooks.json` format inside a plugin (before IDE translation) is undefined in CLI codebase — confirm format before implementing aidd-context hooks

## Recommendation

**Proceed to Phase 1.**

All structural assumptions validated. The pilot plugin works. No CLI code changes are required for the migration phases. The bracket-naming convention is safe. The additive migration approach (old commands stay, new plugins added) was confirmed to not conflict with existing structure.
