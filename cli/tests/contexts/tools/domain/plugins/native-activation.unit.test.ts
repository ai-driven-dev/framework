import { describe, expect, it } from "vitest";
import {
  NativeActivation,
  type NativeActivationSpec,
} from "../../../../../src/contexts/tools/domain/plugins/native-activation.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";

const driven = { binary: "claude", enableVerb: "install", disableVerb: "uninstall" } as const;

describe("NativeActivation", () => {
  it("reads back what the tool declares", () => {
    const activation = new NativeActivation({ ...driven, upgradeVerb: "update" });
    expect([
      activation.hostBinary(),
      activation.cliShape().enableVerb,
      activation.cliShape().disableVerb,
    ]).toEqual(["claude", "install", "uninstall"]);
    expect(activation.cliShape().upgradeVerb).toBe("update");
    expect(activation.cliShape().scopeArgs).toBeUndefined();
  });

  it("does not compile without an enable verb", () => {
    // @ts-expect-error enableVerb is required
    const spec: NativeActivationSpec = { binary: "codex", disableVerb: "remove" };
    expect(spec.binary).toBe("codex");
  });

  it("refuses a declaration whose binary is empty", () => {
    expect(() => new NativeActivation({ ...driven, binary: "" })).toThrow(CapabilityConfigError);
  });

  it("refuses sources read from a marketplace registry the tool does not declare", () => {
    expect(
      () =>
        new NativeActivation({ ...driven, marketplaceSources: { from: "marketplace-registry" } })
    ).toThrow(CapabilityConfigError);
  });

  it("accepts sources read from the marketplace registry it declares", () => {
    const activation = new NativeActivation({
      ...driven,
      marketplaceRegistry: {
        location: (home) => `${home}/registry.json`,
        layout: "install-locations-by-name",
      },
      marketplaceSources: { from: "marketplace-registry" },
    });

    expect(activation.marketplaceSourcesDeclaration()).toStrictEqual({
      from: "marketplace-registry",
    });
  });
});
