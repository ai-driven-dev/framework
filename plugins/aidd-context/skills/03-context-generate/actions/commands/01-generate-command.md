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
target_scope: project_root | plugin:<plugin-name>
target_base: "" | "plugins/<plugin-name>/"
```

## Process

1. Apply the **asset-access precheck** from `@../../references/tool-resolution.md` (## Asset access precheck).
2. Apply the **target scope selection** from `@../../references/tool-resolution.md` (## Target scope selection).
3. **Clarify.** Ask the user until the command's purpose, arguments, `disable-model-invocation` setting, `allowed-tools`, and target model are unambiguous. Field constraints and argument substitution rules: `@../../references/slash-command.md`.
4. **Decide command vs skill.** Flat command files are right for one-shot manual triggers without supporting files; if the command needs `actions/`, `assets/`, or `references/`, redirect the user to the skill-generation flow under `@../skills/01-capture-intent.md` instead.
5. **Fill the template** at `@../../assets/commands/command-template.md`. Required frontmatter: `description`. Recommended: `argument-hint`, `model`, `allowed-tools`, `disable-model-invocation` (default `false`). Reserved placeholder: `$ARGUMENTS` (plus `$0`, `$1`, `$ARGUMENTS[N]`, named-arg `$name`).
6. **Honor framework convention** at `@../../references/command-structure.md`: kebab-case slug, single objective, < 10 steps, English only, no markdown formatting in the rendered output. Use the per-tool path layout from `@../../references/ai-mapping.md` when writing the command file; prepend `target_base` to every output path:
   - **Subdir-tools** (Claude Code, Cursor, OpenCode): place SDLC-phase commands under the phase subfolder (e.g. `<target_base>.claude/commands/10_maintenance/fix-issue.md`). The convention in `command-structure.md` describes this subdir-tool layout.
   - **Flat-tools** (GitHub Copilot): write directly under the prompts root with a phase-index prefix (e.g. `<target_base>.github/prompts/10-fix-issue.prompt.md`). No phase subfolder is created.
7. **Review.** Score the generated command 1-10 on clarity, single-objective focus, and trigger specificity. Boundaries:
   - Frontmatter `description` must include trigger phrases AND a "Do NOT use" clause.
   - Body uses `` !`<command>` `` only for read-only shell injection; mutating commands belong inside the body's instructions, not in dynamic context.
8. **Wait for user confirmation** before writing.
9. **Propose 3 first names** for the command. Each must be short kebab-case and reflect the single objective.
10. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the commands surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools. Write the rendered file to each confirmed supported tool's commands location using `<target_base>`-prefixed CWD-relative paths from the mapping (e.g. `<target_base>.claude/commands/<phase>/<slug>.md`, `<target_base>.github/prompts/<slug>.prompt.md`). Never resolve output paths relative to the plugin install directory.
11. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation).

## Test

```bash
# Test: each written command file exists, starts with YAML frontmatter, has description, and respects target_scope
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  head -1 "$path" | grep -q "^---$" || exit 1
  grep -q "^description:" "$path" || exit 1
  case "$target_scope" in
    project_root)
      [[ "$path" != plugins/* ]] || exit 1 ;;
    plugin:*)
      [[ "$path" == "$target_base"* ]] || exit 1 ;;
  esac
done
echo ok
```

Quality: `quality_score >= 8`; `description` contains trigger phrases and a "Do NOT use" clause (manual check).
