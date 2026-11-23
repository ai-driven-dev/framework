import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../../src/contexts/host-registration/application/host-ports-over.js";
import { ResolveNativeHost } from "../../../../../src/contexts/host-registration/application/register/resolve-native-host.use-case.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";

function portsOf(activators: Map<string, FakeHostActions>, plugins = new Map()) {
  return hostPortsOver({
    activators,
    pluginRegistries: plugins,
    marketplaceRegistries: new Map(),
    sources: new Map(),
  });
}

describe("resolving the native CLI that drives a tool", () => {
  it("answers the profile, the binary it declares and the activator serving it", () => {
    const activator = new FakeHostActions({ available: true });

    const host = new ResolveNativeHost(
      portsOf(new Map([["claude", activator]])),
      registeredTools()
    ).execute(TOOL.claude);

    expect(host?.binary).toBe("claude");
    expect(host?.activator).toBe(activator);
  });

  it("answers the registries wired for that tool", () => {
    const registry = new FakeHostPluginRegistry({ location: "p", refs: new Map() });
    const ports = portsOf(
      new Map([["claude", new FakeHostActions({ available: true })]]),
      new Map([[TOOL.claude, registry]])
    );

    const host = new ResolveNativeHost(ports, registeredTools()).execute(TOOL.claude);

    expect(host?.hosts).toStrictEqual({
      pluginRegistry: registry,
      marketplaceRegistry: undefined,
      sources: undefined,
    });
  });

  it("answers nothing when no activator serves the binary", () => {
    expect(
      new ResolveNativeHost(portsOf(new Map()), registeredTools()).execute(TOOL.claude)
    ).toBeUndefined();
  });
});
