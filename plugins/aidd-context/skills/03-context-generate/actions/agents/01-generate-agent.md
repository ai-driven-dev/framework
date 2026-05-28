# 01 - Generate agent

Generate a specialized agent file tailored to user requirements, validated with the user before write, and saved to each confirmed AI tool's native agents location.

## Inputs

```yaml
agent_request: <free-form description of the agent's purpose, tools, and instructions>
mode: interactive | auto   # optional, default interactive
```

## Outputs

```yaml
files_written:
  - { tool: <id>, path: <tool-specific agents location>/<generated-agent-name>.<ext> }
  - ...
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
name_proposals:
  - <short catchy name 1>
  - <short catchy name 2>
  - <short catchy name 3>
quality_score: 1-10
target_scope: project_root | plugin:<plugin-name>
target_base: "" | "plugins/<plugin-name>/"
```

## Process

1. Apply the **asset-access precheck** from `@../../references/tool-resolution.md` (## Asset access precheck).
2. Apply the **target scope selection** from `@../../references/tool-resolution.md` (## Target scope selection).
3. **Gather requirements.** Ask the user clarifying questions until the agent template is fillable. Iterate until the agent's purpose, tools, inputs, and instructions are unambiguous.
4. **Fill the canonical agent content** using the conventions in `@../../references/ai-mapping.md`. The per-tool templates under `@../../assets/agents/<tool>/` encode the target-specific shape; they are used at step 9 when writing.
5. **Review.** Score the generated agent 1-10 on clarity and completeness. Inputs and outputs MUST be ultra concise and precise.
6. **Wait for user confirmation** before finalizing. In `mode = auto` (called from an upstream skill that has already validated inputs), skip this user-confirmation review gate and continue. Note: the tool-resolution gate (step 8) always runs regardless of mode; in `mode = auto`, the detected signal set becomes the confirmed set automatically without prompting the user.
7. **Propose 3 first names** for the agent. Each name must be short and catchy, making sense with the agent's purpose (word game, acronym, etc.).
8. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the agents surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.
9. **Save.** For each confirmed (non-blocked) tool `<tool>`, copy the template under `@../../assets/agents/<tool>/` (where `<tool>` is the confirmed tool id: `claude`, `cursor`, `opencode`, `copilot`, `codex`), fill the `{{placeholders}}`, and write it to the path resolved from `@../../references/ai-mapping.md` for that tool. Prepend `target_base` to every write path. Never resolve output paths relative to the plugin install directory. Indexing the new file (catalog, docs page, README section, etc.) is the host's responsibility, not this action's.
10. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation).

## Test

```bash
# Test: each rendered agent file exists, starts with YAML frontmatter, and respects target_scope
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  head -1 "$path" | grep -q "^---$" || exit 1
  case "$target_scope" in
    project_root)
      [[ "$path" != plugins/* ]] || exit 1 ;;
    plugin:*)
      [[ "$path" == "$target_base"* ]] || exit 1 ;;
  esac
done
echo ok
```

Quality: `quality_score >= 8` (subjective; manual check).
