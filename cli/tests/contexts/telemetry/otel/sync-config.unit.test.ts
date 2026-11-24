import { expect, it } from "vitest";
import { usageToolForOtel } from "../../../../src/contexts/telemetry/infrastructure/otel/settings.js";

it("maps each OTLP configuration to its ledger provider", () => {
  expect(usageToolForOtel("claude")).toBe("claude-code");
  expect(usageToolForOtel("codex")).toBe("codex");
});
