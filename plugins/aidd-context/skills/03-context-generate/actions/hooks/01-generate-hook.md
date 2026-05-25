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

1. **Resolve target tools.** Follow `@../../references/tool-resolution.md` (detect, propose, confirm 1..N). For each confirmed tool, look up the hooks surface in `@../../references/ai-mapping.md`; if the cell is marked unsupported (D2), record the tool in `blocked_tools` with an explanation and continue with the remaining supported tools.

   D2 cases to apply at this step:
   - **Copilot + project or user scope**: Copilot hooks are plugin-bundled only; project/user scope is not supported. Block with: "Copilot hooks are plugin-bundled only; project/user scope is not supported. Bundle the hook inside a plugin or choose a different tool." Plugin-bundled scope for Copilot remains supported.

2. **Clarify.** Ask the user until the following are unambiguous (event, matcher, handler type, blocking expectation, scope). Use the spec in `@../../references/hook.md` as the source of truth for events, handler fields, exit-code semantics, and the scope -> file resolution table.

3. **Branch on artifact shape for each confirmed supported tool:**
   - **Claude / Cursor / Codex** -> JSON file (or TOML for Codex `[hooks]` table). Use the JSON template at `@../../assets/hooks/hooks-template.json`.
     - Render the event name in the tool's required casing per `@../../references/ai-mapping.md`: Claude and Codex use PascalCase (`PreToolUse`); Cursor uses camelCase (`preToolUse`); OpenCode uses dotted-lowercase event keys (`tool.execute.before`).
   - **OpenCode** -> JS/TS module. OpenCode does not load a standalone `hooks.json`; hooks live inside plugin code. Use the JS template at `@../../assets/hooks/hook-template.js`.
   - **Copilot (plugin-bundled scope only)** -> JSON file (`<plugin>/hooks.json` or `<plugin>/hooks/hooks.json`). Use the JSON template at `@../../assets/hooks/hooks-template.json`.

4. **Resolve `hook_path`** for each confirmed supported tool per `@../../references/hook.md` "File locations and scope" section. Honor the precedence rule: plugin > project > user.

5. **Validate the event name** per tool: Claude and Codex events are validated against the PascalCase table in `@../../references/hook.md`; Cursor events are validated against the camelCase events in the Cursor hooks section of `@../../references/ai-mapping.md`; OpenCode events are validated against the dotted-lowercase events in the OpenCode hooks section of `@../../references/ai-mapping.md`. Block on typo or casing mismatch.

6. **Build the handler object** with only the fields the user supplied, plus the required fields for the chosen handler type per `@../../references/hook.md`. Drop empty optional fields.

7. **Build the matcher entry** for each tool:
   - JSON tools (Claude / Cursor / Codex / Copilot): `{ "matcher": <value or "*">, "hooks": [<handler>] }`.
   - JS module (OpenCode): exported hooks object keyed by event name.

8. **Read each existing hooks surface** (if present). Merge per tool:
   - JSON file: parse, append/merge under the event key, write back.
   - JS module: re-export augmented hooks object; preserve unrelated handlers.
   - If file absent: copy the matching template and substitute placeholders.

9. **Confirm with the user** by printing the diff before write. Wait for written approval.

10. **Score 1-10** on event-handler fit, matcher specificity, and blocking-mode appropriateness (e.g. never expect `PostToolUse` exit code 2 to undo a tool call).

11. **Save** to each `hook_path`.

## Test

For each confirmed supported tool, `hook_path` exists in `files_written`. For JSON outputs (Claude/Cursor/Codex/Copilot plugin-bundled) the file parses as JSON and the rendered entry has the required fields for its `handler_type`. For JS outputs (OpenCode) the file parses as a JS/TS module, exports a default function returning a hooks object whose keys are recognized OpenCode event names. The chosen `event` is one of the event names listed for the target tool in `@../../references/hook.md`. Each D2-blocked tool appears in `blocked_tools` with a non-empty reason; no tool is silently skipped. `quality_score >= 8`.
