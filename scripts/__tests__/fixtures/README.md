# Fixtures

- `architecture-rules/`: skill, action and reference trees the architecture-rule tests read.
- `opencode-session-idle.json`, `opencode-tool-part-completed.json`: captured opencode plugin
  events, read by the CLI's `opencode-hooks-bridge-mapping.integration.test.ts`.
- `telemetry-bindings/`: the contract between the CLI's task declarations and the plugin hooks
  that read them, read by the CLI's `telemetry-bindings-fixture.unit.test.ts`. Its own README
  says what each file pins.
