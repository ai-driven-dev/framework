# Hook events by tool

Measured in non-interactive mode, with small models, in a throwaway folder, project config only. One run per cell (3 for OpenCode and Kilo).
Scope: these limits concern the hooks the framework ships. The hook generator (08) is not bound by the contract.

Versions: Claude 2.1.322, Codex 0.167.1, Copilot 1.0.109, Cursor 2026.10.22 then 2026.11.11 (auto-update during the test), Kilo 7.8.27, OpenCode 1.19.5 and V2 v2.2.7, agy 1.5.5.

## Events fired (observed)

| Tool | SessionStart | UserPrompt | PreTool | PostTool | Stop | SessionEnd | SubagentStop |
|---|---|---|---|---|---|---|---|
| Claude | yes (earlier tests) | yes | yes | yes | yes | yes | documented only |
| Codex | yes | yes | yes | yes | yes | yes | yes |
| Copilot | yes | yes | yes | yes | yes | yes | yes |
| Cursor `-p` | yes | **no** | yes | yes | **no** | yes | not observed |
| Cursor tty (via `script`) | yes | yes | not tested | not tested | yes | yes | not tested |
| Kilo | yes (`session.created`) | yes (`chat.message`) | yes | yes | yes (`session.idle`, then `session.drained`) | not tested | does not exist |
| OpenCode 1.x | yes (`session.created`) | yes (`chat.message`) | yes | yes | yes (`session.idle`) | not tested | does not exist |
| OpenCode V2 | yes (`session.execution.started`) | yes | yes | yes | yes (`session.execution.succeeded`) | not tested | does not exist |
| agy | yes | **no** | yes | yes | yes | **no** | inconclusive (no subagent launched) |

## Reactions (observed)

| Tool | PostTool injects | Stop blocks or relaunches | Refusal at PreTool | Native safeguard |
|---|---|---|---|---|
| Claude | yes (`additionalContext`) | yes (`decision:"block"`) | yes | `stop_hook_active` |
| Codex | yes (cap of 2500 tokens) | yes | yes | `stop_hook_active` |
| Copilot | yes (neutral note) | yes (cap of 8 blocks, `-p` waits since 1.0.107) | yes | `stop_hook_active` |
| Cursor | yes (`additional_context`) | not testable (`stop` absent in `-p`, usage limit reached) | yes | `loop_count` / `loop_limit` 5 [doc] |
| Kilo | yes (`output.output`) | yes, relaunch through `promptAsync` in `session.idle` | yes (`throw`) | none |
| OpenCode 1.x | yes | yes with a fix (see the Stop relaunch section) | yes (`throw`) | none |
| OpenCode V2 | yes | yes without a fix | yes (`throw`) | none |
| agy | not through PostToolUse, yes through PostInvocation `injectSteps` | yes (`decision:"continue"`) | yes | `executionNum` |

Vocabulary for slides: Blocks (Claude, Codex, Copilot, agy), Sends a message (Kilo, OpenCode), Absent / Present.

## Observed particularities

- agy: empty output at PreToolUse means refusal, `{"decision":"allow"}` is required. Hooks live in `.agents/hooks.json`. In `-p`, without `--dangerously-skip-permissions`, tools are refused.
- Codex: `exec` requires `--dangerously-bypass-hook-trust`.
- Copilot: camelCase and PascalCase both fire. Context phrased as a "system instruction" is ignored or refused.
- Cursor: writes into a malformed sibling folder (dash in place of the slash); deleted every time.
- Kilo and OpenCode: the `next` bridge relays only SessionStart, PostToolUse and Stop. PreToolUse and UserPromptSubmit fire natively.
- OpenCode V2: a plugin is a default-exported object `{id, setup(ctx)}` in `.opencode/plugins/<name>/index.js`, with `ctx.tool.hook("execute.before"|"execute.after")` and a `path` field. `experimental.idle` does not exist. The 1.x bridge most likely does not load in V2 (inferred).

## Stop relaunch lost by `opencode run`

- Cause: in `run`, `session.idle` fires while the loop is busy. `prompt()` returns the previous answer in about 14 ms without calling the model, and `run` exits.
- OpenCode 1.19.5: 0/3 without a fix, 3/3 with one (`dispose` awaits the pending `prompt()`, plus a module-level `Set` guard).
- OpenCode V2: 3/3 without a fix. Kilo 7.8.27: 3/3 without a fix (`session.drained`); the `dispose` variant: 0/3.
- Limits: `run` only, 3 runs, small free models, the explanation "the loop waits for the queue" is inferred.

## Gaps against the framework `next` (read through gh)

| Tool | Relayed by the framework | Available natively (observed) |
|---|---|---|
| OpenCode, Kilo | SessionStart, PostToolUse, Stop | plus PreToolUse, UserPromptSubmit |
| Antigravity | SessionStart | plus PreToolUse, PostToolUse, Stop |
| Codex | all | Stop fires |
| Cursor | all, through name translation | `stop`, `beforeSubmitPrompt` absent in `-p` |

## Docs (second pass, undated pages, dates via changelogs)

- Claude: 33 events. Copilot: latest 1.0.110-1. Kilo: latest 7.8.28 (no Stop continuation hook). OpenCode V2: blocking through `permission.evaluate`, no Stop hook documented.
- Cursor: docs silent on the headless CLI; forums contradictory.
- agy: empty output as refusal and `executionNum` are undocumented.

## Not tested

Cursor `followup_message` and reactions in tty (usage limit), SubagentStop on Claude, Cursor, agy, Kilo and OpenCode, compaction, Kilo and OpenCode TUI, models other than the small ones, `agy --settings`, several runs outside Kilo and OpenCode.

## Keeping it current

Tools change fast (agy 1.5.1 to 1.5.5, Cursor updated during the tests). Each line holds for the version given. Re-measure at each version, Cursor first.
