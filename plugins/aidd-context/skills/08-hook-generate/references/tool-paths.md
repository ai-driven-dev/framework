# Tool paths (hooks)

Per-tool hook support, event names, file formats, and scopes. OpenCode and Kilo plugin APIs are guidance surfaces here; this skill does not generate plugins.

## Host detection

Detect Kilo when the project has `.kilo/` (including `.kilo/kilo.json` or `.kilo/kilo.jsonc`), root `kilo.json` or `kilo.jsonc`, or legacy `.kilocode/`. The legacy directory is a detection signal only; new Kilo plugins belong under `.kilo/`. Root `AGENTS.md`, `opencode.json`, or `opencode.jsonc` alone do not identify Kilo. This follows the onboarding detection contract without requiring another installed skill; this generator provides Kilo plugin guidance without writing files.

Kilo detection sources: [project configuration](https://kilo.ai/docs/getting-started/settings) and [legacy directory fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md).

## Per-tool support

| Tool           | Output | Note                                                            |
| -------------- | --------- | --------------------------------------------------------------- |
| Claude Code    | declarative | JSON config + script. Richest event set.                        |
| Codex CLI      | declarative | JSON/TOML config + script. Hooks are stable, on by default.      |
| Cursor         | declarative | JSON config + script.                                           |
| GitHub Copilot | declarative | JSON config + script. Also reads Claude's `.claude/` config.    |
| OpenCode       | guidance | JS/TS plugin module; no declarative config or generated script. |
| Kilo           | guidance | JS/TS plugin module; no declarative config or generated script. |

**Plugin-only guidance.** For OpenCode or Kilo, cite the official plugin documentation and a documented event or typed hook only when its timing and required matcher, payload, and blocking behavior fit the request. Otherwise state the unsupported or unverified limit and do not claim an equivalent. A different moment may be proposed with its differences and explicit confirmation. This generator publishes no hook, backing script, config, or plugin for either tool. In a mixed request, keep this guidance separate from declarative publications.

**OpenCode guidance.** OpenCode hooks are JS/TS plugin code, not a config entry plus a script. The documented directories are `.opencode/plugins/` (project) and `~/.config/opencode/plugins/` (user). The [official plugin reference](https://opencode.ai/docs/plugins) lists `session.created` and `tool.execute.before`/`tool.execute.after`; name one only when its documented semantics fit the requested moment. These paths are OpenCode-supported, not AIDD output destinations.

**Kilo guidance.** The official project path explicitly documented for JavaScript or TypeScript modules is `.kilo/plugin/`; `.kilocode/plugin/` is the legacy path. Recommend `.kilo/plugin/` for new project plugins. Do not present `.kilo/plugins/` as a confirmed project path. These paths are Kilo-supported, not AIDD output destinations; AIDD does not generate a Kilo plugin or hook here. The API exposes typed hooks and an `event` bus. For `session start`, `session.created` is documented; the existing AIDD bridge in `cli/src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts` may be cited only for the events it actually maps. For any other requested moment, check the [official plugin documentation](https://kilo.ai/docs/automate/extending/plugins) and the bridge before naming an equivalent. If the equivalent is unproved, state `unsupported: no documented Kilo event for this requested moment; no fallback mapping`, and ask for a different moment or a separately scoped plugin implementation. Do not create `.kilo/hooks.json`, Claude `hooks.json`, a shell script, or a generic plugin for Kilo.

## Lifecycle moment to event name

Each tool names moments differently and supports a different subset. The table gives documented core event names for declarative tools; it does not itself prove that every matcher, payload, or blocking property fits a request. A `-` means this table has no event for that moment; check the target's official reference before concluding that no such event exists. Never substitute another table row merely because its event occurs nearby.

| Moment             | Claude Code        | Codex CLI       | Cursor               | GitHub Copilot     |
| ------------------ | ------------------ | --------------- | -------------------- | ------------------ |
| session start      | `SessionStart`     | `SessionStart`  | `sessionStart`       | `SessionStart`     |
| prompt submitted   | `UserPromptSubmit` | `UserPromptSubmit` | `beforeSubmitPrompt` | `UserPromptSubmit` |
| before a tool runs | `PreToolUse`       | `PreToolUse`    | `preToolUse`         | `PreToolUse`       |
| after a tool runs  | `PostToolUse`      | `PostToolUse`   | `postToolUse`        | `PostToolUse`      |
| after a tool fails | `PostToolUseFailure` | -           | `postToolUseFailure` | `PostToolUseFailure` |
| before compaction  | `PreCompact`       | `PreCompact`    | `preCompact`         | `PreCompact`       |
| subagent stop      | `SubagentStop`     | `SubagentStop`  | `subagentStop`       | `SubagentStop`     |
| turn stop          | `Stop`             | `Stop`          | `stop`               | `Stop`             |
| session end        | `SessionEnd`       | `SessionEnd`    | `sessionEnd`         | `SessionEnd`       |

Each tool exposes more moments than these. For the full list and event properties, read the tool's docs: Claude `https://code.claude.com/docs/en/hooks`, Codex `https://developers.openai.com/codex/hooks`, Cursor `https://cursor.com/docs/hooks`, Copilot `https://docs.github.com/en/copilot/reference/hooks-configuration`. Confirm the requested meaning and properties before wiring. Copilot also accepts the camelCase names (`sessionStart`, `preToolUse`). The table does not define OpenCode or Kilo equivalents; their guidance follows their documented plugin APIs.

For example, [Claude](https://code.claude.com/docs/en/hooks), [Cursor](https://cursor.com/docs/hooks), and [Copilot](https://docs.github.com/en/copilot/reference/hooks-configuration) document failure-specific tool events. [Codex `PostToolUse`](https://developers.openai.com/codex/hooks) also runs after a non-zero Bash exit, but it also runs after successful tool output. It is not an automatic equivalent of "after a tool fails"; skip Codex for that exact request unless an official failure-specific contract is verified. The tools also differ on validation errors, permission denials, payloads, and blocking, so check the requested properties rather than relying on the event names alone.

## File and format per tool

| Tool           | File                                                              | Shape                                            |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| Claude Code    | `settings.json`, plugin `hooks/hooks.json`, or component frontmatter | `{ "hooks": { "<Event>": [ { "matcher": "...", "hooks": [ { "type": "command", "command": "..." } ] } ] } }` |
| Codex CLI      | `~/.codex/hooks.json` or `[hooks]` in `config.toml`              | same entry shape as Claude.                       |
| Cursor         | `.cursor/hooks.json`                                              | `{ "version": 1, "hooks": { "<event>": [ { "command": "..." } ] } }` |
| GitHub Copilot | `.github/hooks/*.json` or a `hooks` block in `.github/copilot/settings.json` | `{ "version": 1, "hooks": { "<Event>": [ { "type": "command", "command": "..." } ] } }` |

A Claude `settings.json` and a plugin or standalone `hooks/hooks.json` both wrap the event map under a top-level `hooks` key, so the file is `{ "hooks": { "<Event>": [ ... ] } }`. A Codex `config.toml` uses a `[hooks]` table instead.

## Scopes per tool

Ask the user which scope, then write the matching file. A `-` means the tool has no such scope.

| Scope            | Claude Code                    | Codex CLI                  | Cursor                       | GitHub Copilot           |
| ---------------- | ------------------------------ | -------------------------- | ---------------------------- | ------------------------ |
| user / global    | `~/.claude/settings.json`      | `~/.codex/` (`hooks.json` or `config.toml`) | `~/.cursor/hooks.json`       | `~/.copilot/hooks/`      |
| project, shared  | `.claude/settings.json`        | `<repo>/.codex/` (trust-gated) | `.cursor/hooks.json`         | `.github/hooks/`         |
| project, local   | `.claude/settings.local.json`  | -                          | -                            | -                        |
| component / agent | skill or agent frontmatter     | -                          | -                            | `.agent.md` frontmatter  |
| plugin           | plugin `hooks/hooks.json`      | plugin `hooks.json`        | -                            | -                        |
| enterprise / team | managed policy settings        | managed policy             | team or enterprise path      | `policy.d/` or registry  |

Never pick a scope silently. State the resolved file and confirm it.

A component-scoped hook runs only while that component (the skill or agent) is active. A session-start or other always-on moment will not fire reliably from a component. Steer those to a project or user scope.

## Handler contract

The shared `command` handler: a script the tool runs at the moment. It reads the event JSON on stdin, then signals back.

- **Claude / Codex / Copilot.** Exit `0` is success (stdout may carry a JSON object or, on some moments, context). Exit `2` blocks on a moment that honors it (stderr surfaces to the model). Any other code is a non-blocking error.
- **Cursor.** Exit `0` success, exit `2` blocks (same as `permission: "deny"`), any other code fails open. Set `failClosed: true` on the entry to make a crash block instead. Gating moments return `{ "permission": "allow" | "deny" | "ask" }` on stdout.

Per-tool stdout schemas and which moments can block live in each tool's docs (linked above). Codex also has a `notify` mechanism (user scope only, single turn-complete event, JSON on argv not stdin) for a simple turn-complete notification.

## Path placeholders in handlers

Written as `${VAR}` inside a command: `CLAUDE_PROJECT_DIR` (project root), `CLAUDE_PLUGIN_DATA` (plugin data dir), and the plugin install-directory variable (`CLAUDE_PLUGIN` + `_ROOT`). These are Claude tokens. For another tool, use an absolute path or the path the user names.

## Write targets

- **Host project.** Merge the entry into the resolved scope's file for each confirmed supported tool. The script goes in a `hooks/` dir beside the config by default, or another dir the user names, referenced by absolute path or an approved `${VAR}`.
- **Plugin source.** Merge into `plugins/<plugin>/hooks/hooks.json` (the bare hooks object), with the script under `plugins/<plugin>/hooks/scripts/`.
- **OpenCode or Kilo.** No write target. Return the per-tool guidance above for the requested moment, even in a mixed fan-out.

## Safety checks

- **Asset-access precheck.** Before writing, confirm this reference is readable. If not, stop: the plugin is not installed in this host.
- **Merge check.** Before writing, read the target file and confirm the new entry is appended to the moment's list, never overwriting a sibling.
- **Write-target validation.** After writing, confirm the file is valid and every handler path is an approved `${VAR}` or an absolute path under the workspace (a hook command runs from an arbitrary cwd, so an absolute path or `${VAR}` is expected, not a relative one). Otherwise stop and report.
