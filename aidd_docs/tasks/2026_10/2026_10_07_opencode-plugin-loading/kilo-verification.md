# Kilo runtime verification and CI repair

## Initial need
The user requested stronger evidence after the original Kilo smoke test was found to
replace update_memory.js with a marker and stop at session creation. A loaded plugin and
a zero exit code did not prove memory refresh or hooks during a complete turn. The user
also requested correction of the red checks on pull request 971.

## Implemented behavior
The Kilo bridge retains its default id/server descriptor and now supports replayable
SessionStart, PostToolUse and Stop commands. It obtains the real session ID and project
directory from released events, dispatches completed tool parts with their name/input,
filters exact or pipe-separated tool matchers, consumes each tool part once, and resets
idle suppression on the next busy turn. Session deletion removes tracked state. Hook
failure remains reported without blocking the host.

The mutation Vitest configuration now loads .txt assets as source text, matching the
ordinary test configuration. Previously six mutation jobs failed their initial tests
before producing a mutation score because the shared OpenCode adapter was a URL string.
No mutation threshold or bundle budget was changed.

## Added and strengthened tests
- Two added bridge unit cases verify Stop/PostToolUse-only declarations and a released
  session/tool/idle event sequence. The sequence covers real identity and cwd, malformed
  events, incomplete/failed tools, matcher filtering, duplicate events, another busy
  turn and deletion of session state. Existing failed-hook coverage expands to nonzero
  exit, spawn failure and dispatch failure, each reported once without blocking. This
  adds four executed unit cases overall; the bridge suite contains eight cases.
- Six added delivery integration cases cover setup, plugin installation and update for
  each of kilo.jsonc and .kilo/kilo.jsonc. They preserve exact JSONC bytes, comments,
  model, permissions and user MCP configuration. Installation checks the delivered
  script, generated bridge and manifest version; update changes script/version and
  restores a deleted bridge. These execute real application use cases with filesystem
  and fetch doubles; they do not claim execution of the built CLI or Kilo.
- The existing opt-in runtime case now runs Kilo 7.7.5 through a complete model turn.
  The CLI translate command delivers the tested hook modules. The context memory script
  remains byte-identical to its source and must update AGENTS.md. A deterministic
  loopback model endpoint requests the real read tool and receives its actual result.
  An independent observer records host events; captured hooks must contain exactly one
  SessionStart, PostToolUse(read) and Stop with the actual session ID and input. The
  test retains skills, agents and MCP discovery checks, checks unchanged project
  configuration and verifies shutdown of the server and captured hook processes.

Sources of these tests:
- [Bridge unit tests](../../../../cli/tests/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.unit.test.ts)
- [Delivery integration tests](../../../../cli/tests/contexts/framework/application/plugin/kilo-plugin-delivery.integration.test.ts)
- [Real Kilo runtime test](../../../../cli/tests/e2e/kilo-runtime.e2e.test.ts)

## Strategy and observed failures
Released behavior was researched before extending the bridge. The
[official plugin documentation](https://kilo.ai/docs/automate/extending/plugins),
[custom provider documentation](https://kilo.ai/docs/code-with-ai/agents/custom-models)
and [published SDK 7.7.5 types](https://unpkg.com/@kilocode/sdk@7.7.5/dist/v2/gen/types.gen.d.ts)
were checked against a real isolated runtime. Its read part emitted pending, running,
running and completed updates; session.idle ended the turn. Declared types alone were
not treated as execution evidence.

Before the bridge change, the real turn refreshed memory and read the file, but failed
with `expected 1 to be 3`: only SessionStart fired. Bridge regressions also failed before
implementation. The completed runtime case then passed. A first model harness assertion
incorrectly expected exactly two requests; Kilo also makes a title request. The corrected
proof checks actual tool-result content instead of assuming a total request count.

The initial-test CI defect was reproduced with the mutation configuration: two existing
installation/update regressions received the adapter path instead of its source. After
adding .txt, all four runtime-file tests passed. A complete local OpenCode mutation run
then passed with score 96.4 against the unchanged floor of 94.

```sh
pnpm --dir cli test:e2e:kilo
pnpm --dir cli exec vitest run --config vitest.mutation.config.ts tests/contexts/framework/application/plugin/kilo-plugin-delivery.integration.test.ts
pnpm --dir cli test:mutation:tools-opencode
```

Local raw evidence includes /tmp/kilo-hooks-runtime-red.log,
/tmp/kilo-runtime-final.log and /tmp/aidd-971-repair/mutation-opencode-local.log.
The research capture used an allowlisted environment with relocated HOME/XDG paths and
no inherited authentication variables. The committed runtime test follows the same
isolation approach. Only inference is substituted; Kilo, its event bus, read tool,
CLI delivery and spawned hooks execute normally.

## Limits
Kilo telemetry and journal/cost attribution remain unsupported. This proof covers one
successful local turn, plus controlled unit event sequences and application delivery
tests. Paid providers, global installation, hot reload, exhaustive process-tree auditing
and Kilo runtime execution on Windows are not claimed. The ordinary suite deliberately
skips the opt-in host case; the dedicated CI job runs it explicitly.
