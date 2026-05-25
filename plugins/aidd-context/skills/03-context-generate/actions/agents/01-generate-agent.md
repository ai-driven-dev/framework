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

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Choose target scope.** Ask the user: "Write artifacts at the project root, or inside an existing/new plugin?"
   - `project root` (default) -- set `target_base = ""` (empty string). All write paths are CWD-relative literals, landing under the user's workspace root (the host MUST set CWD = workspace).
   - `plugin:<plugin-name>` -- set `target_base = "plugins/<plugin-name>/"`. Confirm the plugin dir exists or create it. All write paths are prepended with `target_base`.
   The action is BLOCKING on this answer. If no answer is received, FAIL with `status: blocked_awaiting_target_scope`.
3. **Gather requirements.** Ask the user clarifying questions until the agent template is fillable. Iterate until the agent's purpose, tools, inputs, and instructions are unambiguous.
4. **Fill the template** at `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/agents/agent-template.md`. Apply the coordination conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/agents-coordination.md`.
5. **Review.** Score the generated agent 1-10 on clarity and completeness. Inputs and outputs MUST be ultra concise and precise.
6. **Wait for user confirmation** before finalizing. In `mode = auto` (called from an upstream skill that has already validated inputs), skip this user-confirmation review gate and continue. Note: the tool-resolution gate (step 8) always runs regardless of mode; in `mode = auto`, the detected signal set becomes the confirmed set automatically without prompting the user.
7. **Propose 3 first names** for the agent. Each name must be short and catchy, making sense with the agent's purpose (word game, acronym, etc.).
8. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the agents surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.
9. **Save.** Write the completed agent file to each confirmed supported tool's native agents location using its path, naming, and extension conventions from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Prepend `target_base` to every write path (e.g. `<target_base>.claude/agents/<name>.md`). Never resolve these paths relative to the plugin install directory.
   - If a confirmed tool is **Codex CLI**, convert the canonical markdown agent to TOML per the Codex CLI section of `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`: frontmatter fields become top-level TOML keys; the markdown body becomes the value of `developer_instructions`. Write the result to `<target_base>.codex/agents/{name}.toml`.
   - For all other tools, write the markdown directly with field-level reconciliation per `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`.
   Indexing the new file (catalog, docs page, README section, etc.) is the host's responsibility, not this action's.
10. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `files_written` satisfies ALL of the following:
    - the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and
    - the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only); and
    - if `target_scope = project root`: the path MUST NOT start with `plugins/<anything>/` (prevents accidental plugin writes); and
    - if `target_scope = plugin:<plugin-name>`: the path MUST start with `plugins/<plugin-name>/`.
    If any path violates any invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected under <target_base>`.

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
