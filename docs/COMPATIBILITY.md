# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | Marketplace only | ✅ |
| Antigravity CLI | `.agents/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Kiro | `.kiro/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Kimi Code CLI | `.kimi-code/` | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Marketplace only | Supported when installed through the tool's marketplace, not as flat files |
| Some events | Only some of the seven events: see Hook events |

## Hook events

What the CLI carries to each host, per event. This is the one table: other pages point here. The Hooks column above is a summary of it.

| Host | SessionStart | UserPromptSubmit | PreToolUse | PostToolUse | Stop | SessionEnd | SubagentStop |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | yes | yes | yes | yes | yes | yes | yes |
| Codex | yes | yes | yes | yes | yes | yes | yes |
| GitHub Copilot | yes | yes | yes | yes | yes | yes | yes |
| Cursor | yes | yes | yes | yes | yes, not headless | no | yes |
| OpenCode | yes, V1 | no, † | no, † | yes, V1 | yes, V1 | no | no |
| Kilo Code | yes | no, † | no, † | yes | yes, not in `kilo run` | no | no |
| Antigravity CLI | yes | no | no | yes, matcher `*` † | yes | no | no |
| Kiro | yes | no | no | no, † | no, † | no | no |
| Kimi Code CLI | no | no | no | no | no | no | no |

| Mark | Meaning |
| --- | --- |
| yes | The CLI writes the event to the host's own hook file or bridge |
| no | The CLI drops the event; a build warns where it can |
| † | Depends on a pull request that is open, so the cell is the current state and the pull request changes it |

Sources, per row:

- Claude Code, Codex, Copilot: the profile declares every event under its own name (`cli/src/composition/tool-profiles/claude.ts`, `codex.ts`, `copilot.ts`). Vendor event lists: [Claude Code](https://code.claude.com/docs/en/hooks), [Codex](https://learn.chatgpt.com/docs/hooks), [Copilot](https://docs.github.com/en/copilot/reference/hooks-configuration), where Copilot names them in camelCase. No host was run for this table; the host-side firing of `SessionEnd` and `SubagentStop` on Copilot is the vendor's word, unverified here.
- Cursor: `cursor.ts` maps six events and skips the rest. Its project `.cursor/hooks.json` is the only file ever observed firing; a plugin-scope `hooks.json` fired none of seven events in three probes.
- OpenCode and Kilo: a generated bridge per plugin, three events only (`opencode.ts`, `kilo.ts`, `bridges/event-bridge.ts`). `†` rows: a pending change relays `PreToolUse` and `UserPromptSubmit` through the bridge, one starts OpenCode's `SessionStart` from `session.created` and one carries a session-start answer to the model.
- Antigravity: `antigravity.ts` maps three events and grants every PostToolUse script the matcher `*`. `†`: a pending change relays `PostToolUse` under agy's own tool names (`write_file`, `edit_file`, `run_command`) and honours a matcher.
- Kiro: `kiro.ts` maps `SessionStart` only. `†`: a pending change adds `PostToolUse` and `Stop`.
- Kimi: [hooks live only in the user-level config](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html); a build warns and ships none.

What an event can do differs per host and is the generator's table, [hosts.md](../plugins/aidd-context/skills/08-hook-generate/references/hosts.md).

## Antigravity limits

- Measured on `agy` 1.5.17 with one probe per case, so each is a fact for that version only. Vendor reference: [hooks](https://antigravity.google/docs/hooks).
- `agy` has no event for a submitted prompt: `PreInvocation` fires before every model call. It has `PreToolUse`, which the CLI does not relay.
- A `PostToolUse` answer injects nothing; only `PostInvocation` and `PreInvocation` can, and the CLI relays neither. `PostInvocation` injection reached the model as a system step in 3 of 3 runs.
- A hook reads its tool by `agy`'s own name. The edit tool is `edit_file`, not `write_file`, and a matcher is an anchored regular expression over the whole name (`write_.*` fired `write_file` only, `write_f` fired nothing).
- `PreToolUse`: `{}` denies, `{"decision":"deny","reason":...}` denies with the reason, `{"decision":"block"}` fails with `unsupported hook decision: block`, and the reason reaches the model on its next tool call. A script exiting non-zero with an allow answer failed closed in single runs.
- `SessionStart` and `PreInvocation` answers shaped `{"injectSteps":[{"systemMessage":{"systemMessage":"<text>"}}]}` reached the model.
- Whether a model acts on a message injected mid-loop depends on the model: it did on `gpt-oss-120b-medium` 3 of 3, on `gemini-3.8-flash-low` 2 of 3, and on `claude-sonnet-4-6` 0 of 6. It is unverified on `gemini-4-hydrogen`, the default model, which probes leave out.
- A hook command runs from the folder holding `hooks.json`, `.agents/`. Hooks come only from the project's `.agents/hooks.json`.
- A `Stop` answer is relayed once: a message raised on a continuation (`executionNum` above 0) is dropped. `continuationActive` stayed false in 5 log entries from two runs, unverified against the vendor's statement that it should be true.
- Unverified, never probed: `PostInvocation` `force_continue` effect on the model, injecting a tool call from a hook (one attempt failed with `unknown injected step type`), `replace_file_content` hook payloads, the IDE, a resumed session under `--continue`.

## Cursor limits

- Measured on `cursor-agent` 2026.10.22 for the captured payloads; a later probe was blocked by the Free tier usage limit, so nothing below was re-run. Vendor reference: [hooks](https://cursor.com/docs/agent/hooks).
- `postToolUse` takes `additional_context` and `updated_mcp_tool_output` only, so a `decision: block` after a write is dropped by design.
- Whether `postToolUse` `additional_context` reaches the model for a built-in tool is unverified. Reports that it does not predate the vendor's fix notice and are not evidence of the current version.
- `preToolUse` deny: the CLI's local deny path reads `user_message`, not `agent_message`, and appends a note telling the model not to work around the block. Unverified at runtime.
- `stop` `followup_message` is submitted as the next user message, with a default `loop_limit` of 5. A headless `cursor-agent -p` delivers no `stop`.

## OpenCode and Kilo limits

- Probed: OpenCode 1.19.3 (V1) and 2.4.1 (V2, published as `@opencode/cli`), Kilo 7.7.5 and 7.8.32. One run per case unless stated.
- The bridge targets V1. On OpenCode 2.4.1 the generated bridge relays no `PreToolUse` and no `UserPromptSubmit`, silently: V2 runs only `setup`, which wires `execute.after` and the event stream. The V2 routes that worked in probes are `tool.hook("execute.before")` with a throw, `session.hook("context")`, `session.instructions.entry.put`, and `session.hook("experimental.idle")` with `session.synthetic`. Which of them the bridge adopts is undecided.
- V2 input names the written file `path`, not `filePath`, so a V2 `PostToolUse` script would get no `file_path`. Only the write input was captured.
- On 2.4.1 with `run --standalone`, the run's own `session.created` never reaches the plugin, so a V2 `SessionStart` does not fire for it. Background service and the interface were not probed.
- A child session also emits `session.created` and `session.idle`, so the bridge runs `SessionStart` and `Stop` per subagent session on 1.19.3. `SubagentStop` is not mapped. `SessionEnd` is unverified: only `location.shutdown` was seen.
- A throw from `chat.message` or `session.hook("prompt")` stops the prompt with no model call, but the reason shows only as `UnknownError` (V1) or HTTP 500 (V2) in `run --format json`. Whether it reaches a person in the interface is unverified; a toast renders on 1.19.3 in the interface, success and error variants included, a 982-character message in full.
- `opencode run` and `kilo run` show no toast. Kilo's interface subscribes to `tui.toast.show` in source; a render was not observed.
- `experimental.chat.system.transform` on V1 also fires for the title call of the same session, and no argument tells the calls apart. V2 keeps `title` a separate hook.
- A `SessionStart` script delays the first model call until it ends, at most its 5 second timeout.
- Kilo `run` exits when the prompt's holds end, and the plugin `event` hook is not awaited: a `Stop` follow-up lands only if the plugin's request beats `run`'s drain request. Running the Stop script synchronously first made it land in 6 of 6 runs on 7.7.5 and 7.8.32, so the bridge's async spawn loses the race. The drain code is identical on 7.7.5, 7.8.27 and 7.8.32: the version split once believed does not exist. A follow-up sent from plugin `dispose` is interrupted, by source at all three tags.
- Two plugins whose `Stop` follow-ups both land loop until killed: each plugin's `continued` flag resets at the idle between the two turns. One run per version; the cause is inferred.
- Source for Kilo: [Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) at tags v7.7.5, v7.8.27 and v7.8.32. Source for OpenCode V2: `@opencode/plugin` 2.4.1.

## Kiro limits

- Kiro receives plugin hooks for `SessionStart` only, merged into `.kiro/hooks/aidd.json` ([hook types](https://kiro.dev/docs/hooks/types/), [hooks file](https://kiro.dev/docs/hooks/)). Every other event is dropped with a build warning, because no payload for it was captured.
- With both a home and a project install, each Kiro `SessionStart` hook runs twice, because Kiro loads both files; both runs resolve to the home copy of the script.
- A script paired across events (aidd-context's artifacts start, mark and check) runs only its `SessionStart` half under Kiro, which is harmless.
- Kiro documents no user-visible hook output field, only standard output added to the agent's context, so a hook's person-facing text is not delivered.
- Probed on `kiro-cli` 3.6.0 (V3), three Free models, one run per case. Text a `PostToolUse` command prints reached the model in none of the shapes tried (bare stdout, `additionalContext`, `decision: block`, exit 1 or 2 with stderr). The same models acted on a hook of type `agent`, so a channel exists; a command's output is not it. Kiro IDE 1.x is unprobed and its docs say hook stdout reaches the agent.
- `Stop`: exit 0 with `{"decision":"block","reason":...}` starts another turn ([hook types](https://kiro.dev/docs/hooks/types/), CLI tab), and so does exit 1, even with no output, in one run. The payload is only `session_id`, `hook_event_name` and `cwd`, so no field marks a continuation. `Stop` fired once per user prompt, never again on the continuation, in every run.
- Payloads captured for `fs_write` (`path`, `text`), `str_replace` (`path`, `oldStr`, `newStr`, `replace_all`), `read_file` and `execute_bash` (`command`, `cwd`).
- A `matcher` is matched by Kiro against its own tool tags: the plugin's `Write|Edit|...` string matched `execute_bash` only, and a bare `write` tag matched `str_replace` and `fs_write`. A Claude matcher therefore cannot be passed through.
- Hooks are not deduplicated: four hooks with one name all ran, and two files with the same command ran it twice. The home plus project case is unprobed; the vendor says [global and workspace hooks run alongside each other](https://kiro.dev/docs/hooks/).
- Kiro's Markdown agents are documented ([configuration reference](https://kiro.dev/docs/custom-agents/configuration-reference/)) but were never run against Kiro. The captured hook runs used CLI V3 JSON agents.

## Kimi Code CLI limits

- Hooks: Kimi reads hooks only from `[[hooks]]` in the user-level `~/.kimi-code/config.toml`, never from a project. A build warns and ships none.
- Agent `tools`: written only when the source declares them, as Kimi names (`WebFetch` becomes `FetchURL`, `Task` becomes `Agent`). A Claude tool with no Kimi name is dropped, which narrows the grant. `model` is not written.
- MCP: written by the flat build to `.kimi-code/mcp.json`. The install does not merge MCP servers for Kimi. A project-level stdio server runs only in a trusted folder.
- An MCP command that names a script under the plugin's `hooks/` folder finds no script: a build copies only the folders the tool has a place for, and Kimi has none for hooks. No shipped plugin does this.
- Skills sit in `.agents/skills/`, shared with Codex and Antigravity.
- Kimi also scans `.agents/agents/`, so in a project built for Antigravity and Kimi, Kimi also sees the Antigravity agents, whose tool names it does not know. Which folder wins is undocumented and not measured, since Kimi is never run here. The two agent files stay separate on purpose: one `tools` list mixing both vocabularies makes an Antigravity subagent fail to start (`unknown component: tool "Read" not found in registry`) while the CLI still exits 0.
- Never run against a live Kimi session by this project.
