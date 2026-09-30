import { describe, expect, it } from "vitest";
import { wireTools } from "../../../src/runtime/wiring/tools.js";

describe("wireTools", () => {
  it("wires one native activator per tool whose profile declares a binary, keyed by that binary", () => {
    const { nativePluginActivators } = wireTools();

    expect([...nativePluginActivators.keys()].sort()).toStrictEqual(["claude", "codex", "copilot"]);
  });

  it("wires the host marketplace registry readers off the same profiles", () => {
    const { hostMarketplaceRegistries } = wireTools();

    expect([...hostMarketplaceRegistries.keys()]).toStrictEqual(["claude"]);
  });
});
