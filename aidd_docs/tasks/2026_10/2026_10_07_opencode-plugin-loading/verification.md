# OpenCode proof

Research: [migration](https://opencode.ai/v2/docs/build/plugins/migrate-v1), [plugin API](https://opencode.ai/v2/docs/build/plugins), [released event types](https://unpkg.com/@opencode/client@2.0.22/dist/promise/generated/types.d.ts). The [V1 loader](https://github.com/anomalyco/opencode/blob/v1.18.29/packages/opencode/src/plugin/index.ts) returns after `default.server`; the [V2 coordinator](https://github.com/anomalyco/opencode/blob/v2.0.22/packages/core/src/session/execution.ts) preserves shutdown-interrupted executions for restart.

Before: V2 reported `Missing key at ["default"]` despite exit zero; memory unchanged, journal empty. Exit status alone could not prove success.

After: real macOS runs passed for translated V1 1.18.29, translated V2 2.0.22, fresh V2 setup and existing V2 installation missing its helper. Each refreshed the seeded memory reference, fired `SessionStart/PostToolUse(read)/Stop` exactly once and wrote `session_start/task_declared/turn_end`. Payloads carried the actual session identity and task-document argument. No loader error; existing configuration preserved byte-for-byte and the helper recorded once as tool-owned.

Observed V2 events were granular tool input/call/success and execution completion, without `session.idle` or content snapshots. The shared adapter correlates inputs, consumes success once and preserves shutdown-interrupted turns. Controlled regressions cover malformed/incomplete/failed events, terminal cleanup and subscription cancellation; these are not live-host failure scenarios. A copied success-consumption mutant failed the duplicate-task assertion. Missing-helper regressions failed before backfill; existing contents and hashes remain protected.

Re-run the committed adapter, payload, generated-layout and delivery regressions:

```sh
node scripts/check-tests-leave-git-alone.js -- node --test scripts/__tests__/opencode-plugin.test.js scripts/__tests__/aidd-telemetry-opencode-payloads.test.js
pnpm --dir cli exec vitest run --project=unit tests/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.unit.test.ts
pnpm --dir cli exec vitest run --project=integration tests/contexts/framework/application/plugin/plugin-runtime-files.integration.test.ts
pnpm --dir cli exec vitest run --project=e2e tests/e2e/opencode-hooks-bridge-generated.e2e.test.ts
```

The real-host probe was temporary and is not a committed reproduction harness. Commands above exercise adapters and delivery, without launching released OpenCode hosts. The observed host runs isolated profiles and substituted only inference with a loopback provider; plugin loading, events, the read tool, hooks and journal were real. Global installation, paid providers, hot reload, other releases/OS and concurrent sessions were not exercised. [Kilo proof](./kilo-verification.md); [final gates](./review.md).
