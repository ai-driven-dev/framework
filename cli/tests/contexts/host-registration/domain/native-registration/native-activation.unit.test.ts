import { describe, expect, it } from "vitest";
import type { NativeActivationSpec } from "../../../../../src/contexts/host-registration/contract/native-registration-spec.js";
import { NativeActivation } from "../../../../../src/contexts/host-registration/domain/native-registration/native-activation.js";

const driven = { binary: "claude", enableVerb: "install", disableVerb: "uninstall" } as const;

describe("a tool's native activation", () => {
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

  it("hands the host CLI every argument and verb the tool declares", () => {
    const declared = {
      ...driven,
      scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
      userRemoveArgs: ["--everywhere"],
      forceRemoveArgs: ["--force"],
      sourceCheckVerb: "list",
      upgradeVerb: "upgrade",
      updateVerb: "update",
      pluginArgs: ["--yes"],
    } as const;

    expect(new NativeActivation(declared).cliShape()).toStrictEqual({
      scopeArgs: declared.scopeArgs,
      userRemoveArgs: declared.userRemoveArgs,
      forceRemoveArgs: declared.forceRemoveArgs,
      sourceCheckVerb: declared.sourceCheckVerb,
      upgradeVerb: declared.upgradeVerb,
      updateVerb: declared.updateVerb,
      enableVerb: declared.enableVerb,
      disableVerb: declared.disableVerb,
      pluginArgs: declared.pluginArgs,
    });
  });

  it("does not compile without an enable verb", () => {
    // @ts-expect-error enableVerb is required
    const spec: NativeActivationSpec = { binary: "codex", disableVerb: "remove" };
    expect(spec.binary).toBe("codex");
  });

  it("refuses a declaration whose binary is empty", () => {
    expect(() => new NativeActivation({ ...driven, binary: "" })).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining("A native activation declares an empty binary"),
      })
    );
  });

  it("refuses sources read from a marketplace registry the tool does not declare", () => {
    expect(
      () =>
        new NativeActivation({ ...driven, marketplaceSources: { from: "marketplace-registry" } })
    ).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining(
          "A native activation reads its marketplace sources from a registry it does not declare"
        ),
      })
    );
  });

  it("accepts sources read from the marketplace registry it declares", () => {
    const activation = new NativeActivation({
      ...driven,
      marketplaceRegistry: {
        location: "{home}/registry.json",
        layout: "install-locations-by-name",
      },
      marketplaceSources: { from: "marketplace-registry" },
    });

    expect(activation.marketplaceSourcesDeclaration()).toStrictEqual({
      from: "marketplace-registry",
    });
  });
});
