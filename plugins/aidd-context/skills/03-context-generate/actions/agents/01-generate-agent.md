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
```

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Gather requirements.** Ask the user clarifying questions until the agent template is fillable. Iterate until the agent's purpose, tools, inputs, and instructions are unambiguous.
3. **Fill the template** at `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/agents/agent-template.md`. Apply the coordination conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/agents-coordination.md`.
4. **Review.** Score the generated agent 1-10 on clarity and completeness. Inputs and outputs MUST be ultra concise and precise.
5. **Wait for user confirmation** before finalizing. In `mode = auto` (called from an upstream skill that has already validated inputs), skip this user-confirmation review gate and continue. Note: the tool-resolution gate (step 7) always runs regardless of mode; in `mode = auto`, the detected signal set becomes the confirmed set automatically without prompting the user.
6. **Propose 3 first names** for the agent. Each name must be short and catchy, making sense with the agent's purpose (word game, acronym, etc.).
7. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the agents surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools.
8. **Save.** Write the completed agent file to each confirmed supported tool's native agents location using its path, naming, and extension conventions from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`.
   - If a confirmed tool is **Codex CLI**, convert the canonical markdown agent to TOML per the Codex CLI section of `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`: frontmatter fields become top-level TOML keys; the markdown body becomes the value of `developer_instructions`. Write the result to `.codex/agents/{name}.toml`.
   - For all other tools, write the markdown directly with field-level reconciliation per `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`.
   Indexing the new file (catalog, docs page, README section, etc.) is the host's responsibility, not this action's.

## Test

For each confirmed tool whose agents surface is supported, the agent file exists at the tool-specific path in `files_written`, matches the structure of `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/agents/agent-template.md`, and uses the correct extension and frontmatter shape from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Each D2-blocked tool appears in `blocked_tools` with a non-empty reason; no tool is silently skipped. `quality_score >= 8`.
