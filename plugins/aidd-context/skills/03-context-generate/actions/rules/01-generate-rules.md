# 01 - Generate rules

Generate or modify coding rules, either from user input (manual mode) or by scanning the codebase (auto mode), then write each rule to the confirmed AI tools' native rules surfaces.

## Inputs

```yaml
arguments: <rule topic to write, or "auto"/"scan" to scan the codebase and propose rules>
```

## Outputs

```yaml
mode: auto | manual
files_written:
  - { tool: <id>, path: <tool rules root>/<category>/<slug>.<ext> }
  - ...
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
```

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.

2. **Detect mode.**
   - `arguments` is `auto` or `scan` -> auto mode (step 3A).
   - `arguments` is empty or absent -> manual mode (step 3B).
   - `arguments` is any other non-empty string -> manual mode (step 3B); the string is a CANDIDATE topic, not a confirmed topic. The user MUST still confirm it in step 3B.

3A. **Auto mode - scan codebase.**
   - Scan source files, configs, dependencies, and directory structure.
   - Identify patterns, conventions, tech stack usage, existing rules.
   - Propose a complete rules architecture: list categories and rule files, show groups and sub-groups per file, display the proposed file tree.
   - WAIT FOR USER APPROVAL before proceeding to step 4.

3B. **Manual mode - user-guided (BLOCKING).**
   - MUST ask the user exactly: "What is the rule topic? Provide a 1-line description (e.g. 'TypeScript naming conventions', 'React hooks structure')."
   - If `arguments` contains a candidate topic string, display it and ask the user to confirm or replace it. Do NOT use the candidate string silently.
   - WAIT for the user's answer before continuing. Do NOT invent a topic, do NOT use a generic placeholder, do NOT proceed with whatever arguments were passed without explicit user confirmation.
   - If no answer is received or the user declines, FAIL with `status: blocked_awaiting_rule_topic`.
   - After topic is confirmed: remind project context (tech stack, versions, architecture, existing rules), define categories (one file per category), look for existing rules to update, plan the new rule(s) structure (file, groups and sub-groups, display the proposed architecture).
   - WAIT FOR USER APPROVAL on the architecture before proceeding to step 4.

4. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the rules surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported, apply the D2 block for that tool and record it in `blocked_tools`. Continue with the remaining supported tools. The valid tool IDs are exactly those listed in `ai-mapping.md` - MUST NOT invent tool names. The known tool IDs are: `claude_code`, `cursor`, `opencode`, `github_copilot`, `codex_cli`.

5. **Pick category + slug deterministically.** Apply the selection rubric in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-structure.md` (walk top to bottom, stop at first hit). The chosen category index drives the slug prefix (rules in `02-programming-languages/` start with `2-`; rules in `03-frameworks-and-libraries/` start with `3-`; etc.). State the chosen category + slug in writing before proceeding.

6. **Generate and write.** Build one canonical rule from the user's intent using `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/rules/rule-template.md` and the conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Render it once per confirmed supported tool using the EXACT per-tool write paths below. These paths are authoritative and MUST NOT be overridden by general AI knowledge.

   **Exact write paths per tool (non-negotiable):**

   - **GitHub Copilot:** MUST write to EXACTLY `.github/instructions/<NN-flat-slug>.instructions.md`. The `<NN-flat-slug>` is the category-index prefix followed by the descriptive slug with no leading `<n>-` (e.g. category `02-programming-languages`, canonical slug `2-typescript-naming` -> `.github/instructions/02-typescript-naming.instructions.md`). Write directly into `.github/instructions/`; no subdirectory is created. MUST NOT write to `.github/copilot-instructions.md` - that file is a context artifact owned by a different action (`02-project-init`), not a rules file.
   - **Claude Code:** MUST write to EXACTLY `.claude/rules/<NN-category-subdir>/<n-slug>.md`. Create the category subdirectory on demand (`mkdir -p`) before writing.
   - **Cursor:** MUST write to EXACTLY `.cursor/rules/<NN-category-subdir>/<n-slug>.mdc`. Create the category subdirectory on demand (`mkdir -p`) before writing.

   All paths are CWD-relative; the host runtime sets the current working directory to the workspace root. `${CLAUDE_PLUGIN_ROOT}` (the plugin install directory) is for READING template and reference files ONLY - MUST NOT be used as a write target for any output file.

   Reference example rule file structure (illustrative):

   ```text
   03-frameworks-and-libraries/
   ├── 3-react@19-components-structure.<ext> (paths: ['**/*.tsx', '**/components/**', ...])
   │   ├── Component definition basics
   │   ├── Export patterns
   │   ├── Props and typing
   │   └── Naming conventions
   └── ...
   ```

7. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `files_written` satisfies BOTH: the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only). If any path violates either invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected a CWD-relative path under the workspace root`.

8. **Boundaries.**
   - Be concise. Less is more.
   - If multiple examples warrant separate files, create multiple rule files.

## Common mistakes to avoid

- MUST NOT use `<plugin>/.../generated/...` or any path under `${CLAUDE_PLUGIN_ROOT}` as a write target. The plugin directory is read-only from this action's perspective.
- MUST NOT write to `.github/copilot-instructions.md` for Copilot rules. That file is a context artifact owned by `02-project-init`. Copilot rules MUST go to `.github/instructions/<slug>.instructions.md`.
- MUST NOT proceed in manual mode without explicit user confirmation of the rule topic. A non-empty `arguments` value is a candidate, not a confirmed topic.
- MUST NOT invent tool names not present in `references/ai-mapping.md`. The valid tool IDs are exactly: `claude_code`, `cursor`, `opencode`, `github_copilot`, `codex_cli`.

## Test

For each confirmed tool whose rules surface is supported, the generated rule file exists at the EXACT path produced by the per-tool write paths in step 6 (subdir path for subdir-tools; flat category-index-prefixed path for flat-tools) with frontmatter matching the tool-specific shape from `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Content follows the conventions in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-writing.md` and `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/rule-structure.md`. Each D2-blocked tool appears in `blocked_tools` with a non-empty reason; no tool is silently skipped. Every path in `files_written` is CWD-relative (no leading `/`) and contains no `${CLAUDE_PLUGIN_ROOT}` component.
