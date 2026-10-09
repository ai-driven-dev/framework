# Kilo verification

Need: replace a session-only smoke that substituted the memory script with a complete real turn and repair red CI. Research preceded implementation: [plugin contract](https://kilo.ai/docs/automate/extending/plugins), [custom provider](https://kilo.ai/docs/code-with-ai/agents/custom-models), [SDK 7.7.5 types](https://unpkg.com/@kilocode/sdk@7.7.5/dist/v2/gen/types.gen.d.ts).

Implementation: map session creation, completed tools and idle to `SessionStart/PostToolUse/Stop`. Preserve actual identity/cwd, parse commands, filter exact or pipe-separated matchers, consume each tool part once, reset idle suppression on busy and release deleted sessions. Report failed hooks without blocking the host.

## Tests

- [Bridge](../../../../cli/tests/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.unit.test.ts): missing declarations/commands, argument parsing, released lifecycle events, malformed/incomplete/failed tools, matchers, replay, new turns and deleted-session recreation. Nonzero exit, spawn and dispatch failures are reported once.
- [Delivery](../../../../cli/tests/contexts/framework/application/plugin/kilo-plugin-delivery.integration.test.ts): setup/install/update for `kilo.jsonc` and `.kilo/kilo.jsonc`; exact JSONC bytes, comments, model, permissions and MCP preserved. Verify scripts/manifest version and restore a deleted bridge. These are application use cases with filesystem/fetch doubles.
- [Checkout](../../../../cli/tests/architecture/bundled-config-checkout.arch.test.ts): isolated real Git checkout with `core.autocrlf=true` preserves LF for embedded assets; removing the attribute rule defeats preservation.
- [Real Kilo 7.7.5](../../../../cli/tests/e2e/kilo-runtime.e2e.test.ts): actual CLI translation, byte-identical memory script updating `AGENTS.md`, skills/agents/MCP discovery, real read/result and exact hook payloads. Independent host observation and a final snapshot after process-group shutdown reject late duplicates. Assert server/captured-process shutdown and model cleanup. Profiles are isolated; only inference is substituted. Translation may normalize JSON; delivered configuration remains byte-identical during execution.

Re-run in a disposable environment, as [CI](../../../../.github/workflows/cli-ci.yml) does; the install command replaces its global Kilo executable:

```sh
npm install -g @kilocode/cli@7.7.5
pnpm --dir cli test:e2e:kilo
pnpm --dir cli exec vitest run --project=unit tests/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.unit.test.ts
pnpm --dir cli exec vitest run --config vitest.mutation.config.ts tests/contexts/framework/application/plugin/kilo-plugin-delivery.integration.test.ts
pnpm --dir cli test:mutation:tools-opencode
pnpm --dir cli test:mutation:tools-kilo
pnpm --dir cli test:arch
```

The ordinary suite skips the opt-in host case; its dedicated CI job runs it explicitly.

## Counterproofs and repairs

Before implementation, the real turn fired only `SessionStart`; bridge regressions also failed. A copied deleted-session mutant failed recreation; injecting an extra final hook failed the exact count assertion. Assertions check the actual tool result rather than request totals because Kilo also requests a title.

The mutation loader reads `.txt` assets as source, matching normal tests. LF checkout fixes Windows bundle growth; thresholds and budget stay unchanged. A stale golden bridge hash was recaptured without changing file lists; comparison mode then passed. Test probes use static code rather than interpolated paths, addressing the [CodeQL embedding rule](https://codeql.github.com/codeql-query-help/javascript/js-bad-code-sanitization/). No alert was suppressed. The obsolete parser wrapper was removed; representative generator inputs produced byte-identical modules after cleanup. [Final gates](./review.md).

Kilo telemetry remains unsupported. Paid providers, global-profile operation, hot reload, exhaustive process-tree auditing and Windows Kilo runtime remain outside this proof.
