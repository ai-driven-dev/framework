import { describe, expect, it } from "vitest";
import {
  NativeActivation,
  type NativeActivationSpec,
} from "../../../../../src/contexts/tools/domain/plugins/native-activation.js";

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

  it("does not compile without an enable verb", () => {
    // @ts-expect-error enableVerb is required
    const spec: NativeActivationSpec = { binary: "codex", disableVerb: "remove" };
    expect(spec.binary).toBe("codex");
  });
});
