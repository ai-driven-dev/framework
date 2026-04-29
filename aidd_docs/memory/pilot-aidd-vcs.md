# Pilot: aidd-vcs — End-to-End Validation

## Outcome: SUCCESS

The aidd-vcs plugin was created and installed end-to-end through the CLI pipeline without any modifications to the CLI code.

## What Was Built

### Plugin structure

```
plugins/aidd-vcs/
  .claude-plugin/plugin.json          ← manifest (claude format)
  README.md                           ← brief plugin description
  skills/
    [3.1] commit/
      SKILL.md                        ← orchestrator
      actions/01-commit.md            ← migrated from commands/08_deploy/commit.md
      assets/commit-template.md       ← copied from aidd_docs/templates/vcs/commit.md
    [3.2] pull-request/
      SKILL.md
      actions/01-pull-request.md      ← migrated from commands/08_deploy/create_request.md
      assets/pull_request.md
      assets/branch.md
      assets/CONTRIBUTING.md
      assets/README.md
    [3.3] release-tag/
      SKILL.md
      actions/01-release-tag.md       ← migrated from commands/08_deploy/tag.md
      assets/release-template.md
    [3.4] issue-create/
      SKILL.md
      actions/01-issue-create.md      ← migrated from commands/10_maintenance/new_issue.md
      assets/issue-template.md
      assets/CONTRIBUTING.md
```

## CLI Install Attempt

Command used (corrected from plan — `--tools` does not exist, the flag is `--tool`):

```bash
node dist/cli.js plugin add /path/to/plugins/aidd-vcs --tool claude
```

Output: `Plugin added successfully.`

## Installed Output Verification

All 17 files written to `.claude/plugins/aidd-vcs/` with bracket names preserved exactly:

```
.claude/plugins/aidd-vcs/.claude-plugin/plugin.json
.claude/plugins/aidd-vcs/skills/[3.1] commit/SKILL.md
.claude/plugins/aidd-vcs/skills/[3.1] commit/actions/01-commit.md
.claude/plugins/aidd-vcs/skills/[3.1] commit/assets/commit-template.md
.claude/plugins/aidd-vcs/skills/[3.2] pull-request/SKILL.md
.claude/plugins/aidd-vcs/skills/[3.2] pull-request/actions/01-pull-request.md
.claude/plugins/aidd-vcs/skills/[3.2] pull-request/assets/CONTRIBUTING.md
.claude/plugins/aidd-vcs/skills/[3.2] pull-request/assets/README.md
.claude/plugins/aidd-vcs/skills/[3.2] pull-request/assets/branch.md
.claude/plugins/aidd-vcs/skills/[3.2] pull-request/assets/pull_request.md
.claude/plugins/aidd-vcs/skills/[3.3] release-tag/SKILL.md
.claude/plugins/aidd-vcs/skills/[3.3] release-tag/actions/01-release-tag.md
.claude/plugins/aidd-vcs/skills/[3.3] release-tag/assets/release-template.md
.claude/plugins/aidd-vcs/skills/[3.4] issue-create/SKILL.md
.claude/plugins/aidd-vcs/skills/[3.4] issue-create/actions/01-issue-create.md
.claude/plugins/aidd-vcs/skills/[3.4] issue-create/assets/CONTRIBUTING.md
.claude/plugins/aidd-vcs/skills/[3.4] issue-create/assets/issue-template.md
```

## Key Findings

### Finding 1: CLI flag correction
The plan says `--tools claude`; the actual CLI flag is `--tool claude` (singular). Minor but would break any scripted automation that copies the plan verbatim.

### Finding 2: assets/ directory passes through unchanged
The `isComponentFile()` function in `plugin-distribution-reader-adapter.ts` checks only top-level segments: `skills`, `commands`, `agents`, `rules`, `hooks`, `.mcp.json`. The `assets/` directories inside skill folders are recursively included because `listDirectory()` collects all files recursively, and `isComponentFile()` returns true for any path whose first segment is `skills`. Assets at `skills/[3.1] commit/assets/commit-template.md` are included.

### Finding 3: Bracket names survive the full pipeline
OS → CLI read → PluginDistribution → installed output: bracket names `[3.1] commit`, `[3.2] pull-request`, etc. are preserved at every stage. No escaping, no renaming, no path collision.

### Finding 4: Plugin installed to tool's plugins dir, not skills dir
Files land in `.claude/plugins/aidd-vcs/skills/[3.1] commit/` NOT the tool's flat skills directory. The plugin lives in the tool's plugins namespace, not the flat skills namespace. This is intentional — skills from plugins are NOT merged into `{{TOOLS}}/skills/`. They stay namespaced under `.claude/plugins/<plugin-name>/`.

This has implications for skill discoverability: Claude Code must look in both the flat skills directory and `.claude/plugins/*/skills/` to find all skills. Verify this is expected behavior before Phase 1.

### Finding 5: No MCP or hooks in aidd-vcs pilot
aidd-vcs has no `.mcp.json` and no `hooks/hooks.json` — correct for a pure VCS workflow plugin.

## Item 11: generate-skill scripts

The framework's `skills/` directory contains only:
- `aidd-auto-implement/`
- `challenge/`

No `generate-skill/` subdirectory and no `scripts/` within skills. Item 11 is N/A — no validate scripts exist that could break with the new structure.

## Lessons Learned

1. The plugin pipeline is already bracket-safe end-to-end — no CLI changes needed for Phase 1 migration.
2. The `--tool` flag (not `--tools`) is the correct install invocation.
3. Assets inside skill directories are included automatically — no special asset handling needed.
4. Plugin skills stay namespaced under `.claude/plugins/` — this is a design decision that affects how skills are referenced from command files (the `@assets/` references in actions point to relative paths within the plugin, not to the tool's global skills dir).
5. Additive migration is clean — `commands/08_deploy/` and `commands/10_maintenance/new_issue.md` are untouched.
