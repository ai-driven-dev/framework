# 01 - Generate command

Generate a flat slash command file (one `.md`, frontmatter + body) and save it to the matching commands location for each confirmed AI tool.

## Inputs

- `command_request` (required) - free-form description of the command's purpose, expected arguments, allowed tools, and whether Claude can auto-invoke it.

## Outputs

```yaml
files_written:
  - { tool: <id>, path: <tool-specific commands location>/<command-name>.<ext> }
  - ...
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
name_proposals:
  - <short slug 1>
  - <short slug 2>
  - <short slug 3>
quality_score: 1-10
```

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Clarify.** Ask the user until the command's purpose, arguments, `disable-model-invocation` setting, `allowed-tools`, and target model are unambiguous. Field constraints and argument substitution rules: `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/slash-command.md`.
3. **Decide command vs skill.** Flat command files are right for one-shot manual triggers without supporting files; if the command needs `actions/`, `assets/`, or `references/`, redirect the user to the skill-generation flow under `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/actions/skills/01-capture-intent.md` instead.
4. **Fill the template** at `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/commands/command-template.md`. Required frontmatter: `description`. Recommended: `argument-hint`, `model`, `allowed-tools`, `disable-model-invocation` (default `false`). Reserved placeholder: `$ARGUMENTS` (plus `$0`, `$1`, `$ARGUMENTS[N]`, named-arg `$name`).
5. **Honor framework convention** at `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/command-structure.md`: kebab-case slug, single objective, < 10 steps, English only, no markdown formatting in the rendered output. Use the per-tool path layout from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` when writing the command file; all output paths are CWD-relative:
   - **Subdir-tools** (Claude Code, Cursor, OpenCode): place SDLC-phase commands under the phase subfolder (e.g. `.claude/commands/10_maintenance/fix-issue.md`). The convention in `command-structure.md` describes this subdir-tool layout.
   - **Flat-tools** (GitHub Copilot): write directly under the prompts root with a phase-index prefix (e.g. `.github/prompts/10-fix-issue.prompt.md`). No phase subfolder is created.
6. **Review.** Score the generated command 1-10 on clarity, single-objective focus, and trigger specificity. Boundaries:
   - Frontmatter `description` must include trigger phrases AND a "Do NOT use" clause.
   - Body uses `` !`<command>` `` only for read-only shell injection; mutating commands belong inside the body's instructions, not in dynamic context.
7. **Wait for user confirmation** before writing.
8. **Propose 3 first names** for the command. Each must be short kebab-case and reflect the single objective.
9. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the commands surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools. Write the rendered file to each confirmed supported tool's commands location using CWD-relative paths from the mapping (e.g. `.claude/commands/<phase>/<slug>.md`, `.github/prompts/<slug>.prompt.md`). Never resolve output paths relative to the plugin install directory.

## Test

For each confirmed tool whose commands surface is supported, a file exists at the tool-specific path in `files_written`; its YAML frontmatter parses (between two `---` lines, valid key/value pairs); `description` is non-empty and contains both trigger phrases and a "Do NOT use" clause; the body contains at least one of `$ARGUMENTS`, `$0` ... `$N`, `$ARGUMENTS[N]`, or a `$name` substitution declared in the `arguments` frontmatter list whenever the command takes arguments (vacuous when it does not). Each D2-blocked tool appears in `blocked_tools` with a non-empty reason; no tool is silently skipped. `quality_score >= 8`.
