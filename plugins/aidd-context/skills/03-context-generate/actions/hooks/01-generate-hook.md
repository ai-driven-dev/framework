# 01 - Generate hook

Generate a hook entry (one event + one matcher + one or more handlers) for the requested AI tool and write it to the matching scope's hooks surface.

## Inputs

- `hook_request` (required) - free-form description of what to react to (event), under what condition (matcher / `if`), and what should happen (handler).

## Outputs

```yaml
target_tool: claude | cursor | codex | opencode | copilot
hook_path: <scope-specific path to the hooks file>
event: <one of the supported event names>
matcher: <string; "*" if not narrowed>
handler_type: command | http | prompt | agent | mcp_tool
quality_score: 1-10
```

## Process

1. **Clarify.** Ask the user until the following are unambiguous (target tool, event, matcher, handler type, blocking expectation, scope). Use the spec in `@../../references/hook.md` as the source of truth for events, handler fields, exit-code semantics, and the scope -> file resolution table.
2. **Branch on `target_tool` for the artifact shape:**
   - **Claude / Cursor / Codex** -> JSON file (or TOML for Codex `[hooks]` table). Use the JSON template at `@../../assets/hooks/hooks-template.json`.
   - **OpenCode** -> JS/TS module. OpenCode does not load a standalone `hooks.json`; hooks live inside plugin code. Use the JS template at `@../../assets/hooks/hook-template.js`.
   - **Copilot** -> JSON file, but ONLY plugin-bundled (`<plugin>/hooks.json` or `<plugin>/hooks/hooks.json`). Reject project/user scope for Copilot with a clear error.
3. **Resolve `hook_path`** per `@../../references/hook.md` "File locations and scope" section. Honor the precedence rule: plugin > project > user.
4. **Validate the event name** against the table in `@../../references/hook.md`. Event names differ across tools (e.g. Cursor uses camelCase `preToolUse`; Claude/Codex use PascalCase `PreToolUse`). Block on typo.
5. **Build the handler object** with only the fields the user supplied, plus the required fields for the chosen handler type per `@../../references/hook.md`. Drop empty optional fields.
6. **Build the matcher entry** `{ "matcher": <value or "*">, "hooks": [<handler>] }` (JSON case) OR an exported hooks object keyed by event name (JS case).
7. **Read the existing hooks surface** (if present). Merge:
   - JSON file: parse, append/merge under the event key, write back.
   - JS module: re-export augmented hooks object; preserve unrelated handlers.
   - If file absent: copy the matching template and substitute placeholders.
8. **Confirm with the user** by printing the diff before write. Wait for written approval.
9. **Score 1-10** on event-handler fit, matcher specificity, and blocking-mode appropriateness (e.g. never expect `PostToolUse` exit code 2 to undo a tool call).
10. **Save** to `hook_path`.

## Test

`hook_path` exists. For JSON outputs (Claude/Cursor/Codex/Copilot) the file parses as JSON and the rendered entry has the required fields for its `handler_type`. For JS outputs (OpenCode) the file parses as a JS/TS module, exports a default function returning a hooks object whose keys are recognized OpenCode event names. The chosen `event` is one of the event names listed for the target tool in `@../../references/hook.md`. `quality_score >= 8`.
