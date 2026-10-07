# OpenCode plugin loading verification

Source: [framework issue 953](https://github.com/ai-driven-dev/framework/issues/953).
Research and local runtime checks performed on 2026-10-07, macOS ARM64, Node 24.20.0.

## Research findings

- [The official migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1) requires a default definition with id/setup for V2 and documents server compatibility beginning with V1 1.18.29.
- [The plugin API](https://opencode.ai/v2/docs/build/plugins) supplies location.directory, an asynchronous event subscription, and cleanup through an AbortSignal.
- [Published client 2.0.22 types](https://unpkg.com/@opencode/client@2.0.22/dist/promise/generated/types.d.ts) use data/location instead of V1 properties. A declared event is not proof that the runtime emits it.
- [The V1 1.18.29 loader](https://github.com/anomalyco/opencode/blob/v1.18.29/packages/opencode/src/plugin/index.ts) prefers default.server and returns before processing named factories. Keeping the named test seams does not execute the plugin twice.
- [The V2 2.0.22 execution coordinator](https://github.com/anomalyco/opencode/blob/v2.0.22/packages/core/src/session/execution.ts) emits succeeded, failed, or interrupted. A shutdown interruption preserves the execution claim for a later restart; it must not close the journal turn.

## Real reproduction before the fix

The built CLI translated the unchanged framework into a temporary project. The released
OpenCode V2 2.0.22 binary ran a real session and read a task document using a local
OpenAI-compatible deterministic provider.

Both modules failed with `Plugin must export a default definition` and
`Missing key at ["default"]`. The process nevertheless exited zero. Memory was unchanged;
the journal contained no records. Exit status alone would have falsely passed this test.

The same unchanged framework under V1 1.18.29 refreshed memory and wrote session_start,
task_declared and turn_end.

## Real runtime results after the fix

The temporary source copy added marker hooks to the context plugin's existing hooks.json
for SessionStart, Stop, and PostToolUse with matcher read. The actual built CLI translated
that source; no generated adapter was repaired by hand. The telemetry module was unchanged
from the candidate source.

Both released binaries exited zero and produced all of these effects:

- The AGENTS.md memory block referenced the seeded architecture.md.
- Generic hooks fired exactly once each, in order: SessionStart, PostToolUse, Stop.
- PostToolUse carried tool_name read and the actual task-document argument.
- Exactly one session_start, one task_declared and one turn_end were written.
- The session_start vendor_id matched the actual session ID reported by OpenCode.
- Neither adapter produced a plugin load error.

The V2 observation stream contained session.created, session.tool.input.started,
session.tool.called, session.tool.success and session.execution.succeeded. It contained
neither session.idle nor session.message.content.updated. The adapter therefore correlates
the measured tool events and consumes each success once; merely adding a default export
or adapting the declared content snapshot would not have satisfied this reproduction.

## Local commands and evidence

Temporary harness and logs are under /tmp/aidd-953-runtime-ryTstm. The harness preserves
its model requests, stdout, stderr, passive V2 event capture and JSON summaries per case.
It launches the real host with a restricted environment, relocated profile directories,
a temporary git project and a loopback model endpoint. No personal credentials are passed.

```sh
npm install --prefix /tmp/aidd-953-runtime-ryTstm/v1 --no-audit --no-fund opencode-ai@1.18.29
npm install --prefix /tmp/aidd-953-runtime-ryTstm/v2 --no-audit --no-fund @opencode/cli@2.0.22
pnpm --dir cli build
python3 /tmp/aidd-953-runtime-ryTstm/prepare.py
node cli/dist/cli.js translate /tmp/aidd-953-runtime-ryTstm/fixture-source --to opencode --as flat --out /tmp/aidd-953-runtime-ryTstm/candidate --force
python3 /tmp/aidd-953-runtime-ryTstm/probe.py /tmp/aidd-953-runtime-ryTstm/candidate v1
python3 /tmp/aidd-953-runtime-ryTstm/probe.py /tmp/aidd-953-runtime-ryTstm/candidate v2
```

The V2 command uses run --standalone; neither test starts a persistent background service.
The installed personal OpenCode 1.14.20 and its profile were not upgraded or used.

## Automated validation

- Full CLI suite: 6,807 passed, one opt-in Kilo runtime test skipped; 529 files passed.
- Focused OpenCode and cost-documentation scripts: 48 passed, after observing the stale documentation assertion fail first.
- All 140 architecture checks passed without increasing comment or empty-catch baselines.
- Lint, TypeScript, type honesty, knip, duplicate-code budget and whitespace checks passed. Lint retains one existing unused-private-member warning in uninstall-use-case.ts, outside this change.
- Built CLI: 730.3 KB, below the existing 734 KB budget.
- Both emitted plugin files passed node --check.
- An isolated mutation removing success consumption made the duplicate-task regression fail; the production source was not mutated.

Architecture conformance: no macro violations; generic translation stays in the tools
profile, telemetry observes through its existing adapter, and hook tests remain outside
shipped plugin trees. No micro violations: the source generator remains a pure transform
and the generated runtime gains no package dependency or cross-plugin import.

## Scope of the evidence

Real runtime coverage is a single-project successful session under V1 1.18.29 and V2
2.0.22. Regression tests exercise stream cleanup, malformed events, incomplete and failed
tools, repeated success, concurrent tool identities, and execution termination behavior.
Paid inference, global-profile installation, other operating systems and a running host's
hot reload are not claimed by this local proof. The local deterministic model substitutes
only inference; OpenCode's plugin loader, event stream, read tool, hook processes and
journal are real.
