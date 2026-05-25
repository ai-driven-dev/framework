# 01 - Generate hook

Generate a hook entry (one event + one matcher + one or more handlers) for each confirmed AI tool and write it to the matching scope's hooks surface.

## Inputs

- `hook_request` (required) - free-form description of what to react to (event), under what condition (matcher / `if`), and what should happen (handler).

## Outputs

```yaml
files_written:
  - { tool: <id>, hook_path: <scope-specific path to the hooks file> }
  - ...
blocked_tools:
  - { tool: <id>, reason: <D2 explanation> }
event: <one of the supported event names>
matcher: <string; "*" if not narrowed>
handler_type: command | http | prompt | agent | mcp_tool
quality_score: 1-10
```

## Process

1. **Verify asset access.** Read `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md` AND `${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md`. If EITHER read fails, returns empty content, or `${CLAUDE_PLUGIN_ROOT}` is not resolved by the host (resulting in a literal string Read attempt rather than absolute-path access), FAIL with `status: blocked_assets_unreachable: cannot read references via ${CLAUDE_PLUGIN_ROOT}. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure ${CLAUDE_PLUGIN_ROOT} resolves to the plugin install root) before running this action.` Do NOT proceed, do NOT invent a tool list, do NOT guess paths.
2. **Resolve target tools.** Follow `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the hooks surface in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; if the cell is marked unsupported (D2), record the tool in `blocked_tools` with an explanation and continue with the remaining supported tools.

   D2 cases to apply at this step:
   - **Copilot + project or user scope**: Copilot hooks are plugin-bundled only; project/user scope is not supported. Block with: "Copilot hooks are plugin-bundled only; project/user scope is not supported. Bundle the hook inside a plugin or choose a different tool." Plugin-bundled scope for Copilot remains supported.

3. **Clarify.** Ask the user until the following are unambiguous (event, matcher, handler type, blocking expectation, scope). Use the spec in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/hook.md` as the source of truth for events, handler fields, exit-code semantics, and the scope -> file resolution table.

4. **Branch on artifact shape for each confirmed supported tool:**
   - **Claude / Cursor / Codex** -> JSON file (or TOML for Codex `[hooks]` table). Use the JSON template at `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/hooks/hooks-template.json`.
     - Render the event name in the tool's required casing per `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`: Claude and Codex use PascalCase (`PreToolUse`); Cursor uses camelCase (`preToolUse`); OpenCode uses dotted-lowercase event keys (`tool.execute.before`).
   - **OpenCode** -> JS/TS module. OpenCode does not load a standalone `hooks.json`; hooks live inside plugin code. Use the JS template at `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/hooks/hook-template.js`.
   - **Copilot (plugin-bundled scope only)** -> JSON file (`<plugin>/hooks.json` or `<plugin>/hooks/hooks.json`). Use the JSON template at `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/hooks/hooks-template.json`.

5. **Resolve `hook_path`** for each confirmed supported tool per `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/hook.md` "File locations and scope" section. Honor the precedence rule: plugin > project > user. For project-scope hooks, `hook_path` is CWD-relative (e.g. `.claude/settings.json`); the host runtime sets CWD to the workspace root, not the plugin install directory.

6. **Validate the event name** per tool: Claude and Codex events are validated against the PascalCase table in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/hook.md`; Cursor events are validated against the camelCase events in the Cursor hooks section of `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`; OpenCode events are validated against the dotted-lowercase events in the OpenCode hooks section of `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/ai-mapping.md`. Block on typo or casing mismatch.

7. **Build the handler object** with only the fields the user supplied, plus the required fields for the chosen handler type per `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/hook.md`. Drop empty optional fields.

8. **Build the matcher entry** for each tool:
   - JSON tools (Claude / Cursor / Codex / Copilot): `{ "matcher": <value or "*">, "hooks": [<handler>] }`.
   - JS module (OpenCode): exported hooks object keyed by event name.

9. **Read each existing hooks surface** (if present). Merge per tool:
   - JSON file: parse, append/merge under the event key, write back.
   - JS module: re-export augmented hooks object; preserve unrelated handlers.
   - If file absent: copy the matching template and substitute placeholders.

10. **Confirm with the user** by printing the diff before write. Wait for written approval.

11. **Score 1-10** on event-handler fit, matcher specificity, and blocking-mode appropriateness (e.g. never expect `PostToolUse` exit code 2 to undo a tool call).

12. **Save** to each `hook_path` directly (CWD-relative path). Never write relative to the plugin install directory.
13. **Post-write path check (MANDATORY).** After writing, MUST verify that every file in `files_written` satisfies BOTH:
    - the path is RELATIVE (no leading `/`), so it lives under the host's CWD (= workspace root); and
    - the path does NOT contain `${CLAUDE_PLUGIN_ROOT}` (would mean we wrote into the plugin install dir, which is read-only).
    If any path violates either invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected a CWD-relative path under the workspace root`.

## Test

For each confirmed supported tool, `hook_path` exists in `files_written`. For JSON outputs (Claude/Cursor/Codex/Copilot plugin-bundled) the file parses as JSON and the rendered entry has the required fields for its `handler_type`. For JS outputs (OpenCode) the file parses as a JS/TS module, exports a default function returning a hooks object whose keys are recognized OpenCode event names. The chosen `event` is one of the event names listed for the target tool in `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/references/hook.md`. Each D2-blocked tool appears in `blocked_tools` with a non-empty reason; no tool is silently skipped. `quality_score >= 8`.
