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
target_scope: project_root | plugin:<plugin-name>
target_base: "" | "plugins/<plugin-name>/"
```

## Process

1. Apply the **asset-access precheck** from `@../../references/tool-resolution.md` (## Asset access precheck).
2. Apply the **target scope selection** from `@../../references/tool-resolution.md` (## Target scope selection).
3. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the hooks surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported (D2), record the tool in `blocked_tools` with an explanation and continue with the remaining supported tools.

   D2 cases to apply at this step:
   - **Copilot + project or user scope**: Copilot hooks are plugin-bundled only; project/user scope is not supported. Block with: "Copilot hooks are plugin-bundled only; project/user scope is not supported. Bundle the hook inside a plugin or choose a different tool." Plugin-bundled scope for Copilot remains supported.

4. **Clarify.** Ask the user until the following are unambiguous (event, matcher, handler type, blocking expectation, scope). Use the spec in `@../../references/hook.md` as the source of truth for events, handler fields, exit-code semantics, and the scope -> file resolution table.

5. **Branch on artifact shape for each confirmed supported tool:**
   - **Claude / Cursor / Codex** -> JSON file (or TOML for Codex `[hooks]` table). Use the JSON template at `@../../assets/hooks/hooks-template.json`.
     - Render the event name in the tool's required casing per `@../../references/ai-mapping.md`: Claude and Codex use PascalCase (`PreToolUse`); Cursor uses camelCase (`preToolUse`); OpenCode uses dotted-lowercase event keys (`tool.execute.before`).
   - **OpenCode** -> JS/TS module. OpenCode does not load a standalone `hooks.json`; hooks live inside plugin code. Use the JS template at `@../../assets/hooks/hook-template.js`.
   - **Copilot (plugin-bundled scope only)** -> JSON file (`<plugin>/hooks.json` or `<plugin>/hooks/hooks.json`). Use the JSON template at `@../../assets/hooks/hooks-template.json`.

6. **Resolve `hook_path`** for each confirmed supported tool per `@../../references/hook.md` "File locations and scope" section. Honor the precedence rule: plugin > project > user. For project-scope hooks, prepend `target_base` to the CWD-relative path (e.g. `<target_base>.claude/settings.json`); the host runtime sets CWD to the workspace root, not the plugin install directory.

7. **Validate the event name** per tool: Claude and Codex events are validated against the PascalCase table in `@../../references/hook.md`; Cursor events are validated against the camelCase events in the Cursor hooks section of `@../../references/ai-mapping.md`; OpenCode events are validated against the dotted-lowercase events in the OpenCode hooks section of `@../../references/ai-mapping.md`. Block on typo or casing mismatch.

8. **Build the handler object** with only the fields the user supplied, plus the required fields for the chosen handler type per `@../../references/hook.md`. Drop empty optional fields.

9. **Build the matcher entry** for each tool:
   - JSON tools (Claude / Cursor / Codex / Copilot): `{ "matcher": <value or "*">, "hooks": [<handler>] }`.
   - JS module (OpenCode): exported hooks object keyed by event name.

10. **Read each existing hooks surface** (if present). Merge per tool:
    - JSON file: parse, append/merge under the event key, write back.
    - JS module: re-export augmented hooks object; preserve unrelated handlers.
    - If file absent: copy the matching template and substitute placeholders.

11. **Confirm with the user** by printing the diff before write. Wait for written approval.

12. **Score 1-10** on event-handler fit, matcher specificity, and blocking-mode appropriateness (e.g. never expect `PostToolUse` exit code 2 to undo a tool call).

13. **Save** to each `hook_path` (prepended with `target_base`). Never write relative to the plugin install directory.
14. Apply the **write target validation** from `@../../references/tool-resolution.md` (## Write target validation).

## Test

```bash
# Test: each written hook file exists, JSON files parse as valid JSON, and target_scope is respected
for path in "${files_written[@]}"; do
  test -f "$path" || exit 1
  case "$path" in
    *.json) node -e "JSON.parse(require('fs').readFileSync('$path','utf8'))" || exit 1 ;;
  esac
  case "$target_scope" in
    project_root)
      [[ "$path" != plugins/* ]] || exit 1 ;;
    plugin:*)
      [[ "$path" == "$target_base"* ]] || exit 1 ;;
  esac
done
echo ok
```

Quality: `quality_score >= 8`; event name valid for target tool per `references/hook.md` (manual check).
