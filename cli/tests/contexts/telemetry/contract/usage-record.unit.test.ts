import { describe, expect, it } from "vitest";
import {
  USAGE_AGENTS,
  USAGE_TOOLS,
} from "../../../../src/contexts/telemetry/contract/usage-record.js";

describe("what a usage record may name", () => {
  it.each([
    ["tools", USAGE_TOOLS],
    ["agents", USAGE_AGENTS],
  ])("offers each of the %s once, spelled as a command-line choice", (_, values) => {
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
  });
});
