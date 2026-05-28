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
3. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the hooks surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported (D2), record the tool in `blocked_tools` with an explanation and continue with the remaining supported tools. All five tools support hooks, each with its own surface and scope set per `@../../references/ai-mapping.md` (resolve the scope path from there); there is no per-tool hook D2.

4. **Clarify.** Ask the user until the following are unambiguous (event, matcher, handler type, blocking expectation, scope). Use the spec in `@../../references/hook.md` as the source of truth for events, handler fields, exit-code semantics, and the scope -> file resolution table.

5. **Render artifact for each confirmed supported tool.** For each confirmed (non-blocked) tool `<tool>`, copy the template under `@../../assets/hooks/<tool>/` (where `<tool>` is the confirmed tool id: `claude`, `cursor`, `codex`, `copilot`, `opencode`), fill the `{{placeholders}}`, and resolve the event name casing and scope path from `@../../references/ai-mapping.md`.

6. **Resolve `hook_path`** for each confirmed supported tool per `@../../references/hook.md` "File locations and scope" section. Honor the precedence rule: plugin > project > user. For project-scope hooks, prepend `target_base` to the CWD-relative path (e.g. `<target_base>.claude/settings.json`); the host runtime sets CWD to the workspace root, not the plugin install directory.

7. **Validate the event name** for each tool against the **Hook event casing per tool** table in `@../../references/ai-mapping.md` (casing) and the event-name list in `@../../references/hook.md` (Claude Code depth). Block on typo or casing mismatch.

8. **Build the handler object** with only the fields the user supplied, plus the required fields for the chosen handler type per `@../../references/hook.md`. Drop empty optional fields.

9. **Build the matcher entry** for each confirmed (non-blocked) tool by following the structure defined in the template copied in step 5 for that tool. The template encodes whether the artifact is a JSON matcher entry or a JS module export.

10. **Read each existing hooks surface** (if present). Merge per tool: append/merge the new entry under the event key, preserving unrelated handlers. If the file is absent, copy the template from step 5 and substitute placeholders. The merge strategy (JSON key merge vs JS module re-export) is determined by the template format for that tool.

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
