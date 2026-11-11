import { describe, expect, it } from "vitest";
import { NativeActivation } from "../../../../../src/contexts/tools/domain/plugins/native-activation.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";

const driven = { binary: "claude", enableVerb: "install", disableVerb: "uninstall" } as const;

describe("NativeActivation", () => {
  it("reads back what the tool declares", () => {
    const activation = new NativeActivation({ ...driven, upgradeVerb: "update" });
    expect([activation.binary, activation.enableVerb, activation.disableVerb]).toEqual([
      "claude",
      "install",
      "uninstall",
    ]);
    expect(activation.upgradeVerb).toBe("update");
    expect(activation.scopeArgs).toBeUndefined();
  });

  it("refuses an empty binary", () => {
    expect(() => new NativeActivation({ ...driven, binary: "" as "claude" })).toThrow(
      CapabilityConfigError
    );
  });

  it("refuses a missing enable verb", () => {
    expect(() => new NativeActivation({ binary: "codex", disableVerb: "remove" })).toThrow(
      "enableVerb"
    );
  });

  it("refuses a missing disable verb", () => {
    expect(() => new NativeActivation({ binary: "codex", enableVerb: "add" })).toThrow(
      "disableVerb"
    );
  });
});
