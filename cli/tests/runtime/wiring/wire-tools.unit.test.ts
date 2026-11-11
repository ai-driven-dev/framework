import { describe, expect, it } from "vitest";
import { wireTools } from "../../../src/runtime/wiring/tools.js";

describe("wireTools", () => {
  it("wires one native activator per tool whose profile declares a binary, keyed by that binary", () => {
    const { hostActions } = wireTools();

    expect([...hostActions.keys()].sort()).toStrictEqual(["claude", "codex", "copilot"]);
  });

  it("wires the host marketplace registry readers off the same profiles", () => {
    const { marketplaceRegistries } = wireTools();

    expect([...marketplaceRegistries.keys()]).toStrictEqual(["claude"]);
  });
});
