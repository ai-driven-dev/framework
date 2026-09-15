import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { describe, expect, it } from "vitest";
import { NativeHostRegistrationGate } from "../../../../../src/contexts/framework/application/ownership/native-host-registration-gate.js";
import type { NativeRegistrations } from "../../../../../src/contexts/framework/domain/manifest/native-registrations.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type { NativePluginActivator } from "../../../../../src/contexts/tools/domain/ports/native-plugin-activator.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";

const REF = "test-plugin@real-catalog";
const HOST = "real-catalog";
const claim = { ref: REF, dependents: [] };
const registrations: NativeRegistrations = {
  binary: "copilot",
  marketplaces: [{ alias: "alias", hostName: HOST }],
  pluginRefs: [REF],
  pluginClaims: [claim],
};

describe("native host registration gate", () => {
  const reader = (refs?: ReadonlyMap<string, { enabled: boolean; scope?: "user" | "project" }>) =>
    ({
      read: async () => ({ location: "/host/registry", refs }),
    }) satisfies HostPluginRegistryReader;
  const enabled = () => new Map([[REF, { enabled: true, scope: "user" as const }]]);

  it("requires the verified target-update verb before contacting a Codex host", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const gate = new NativeHostRegistrationGate(
      new Map([["codex", activator]]),
      new Map([["codex", reader(enabled())]])
    );
    await expect(gate.requireTargetedUpdate("codex", claim, "/A")).rejects.toThrow(
      /does not support targeted native plugin update/
    );
    expect(activator.updatedPlugins).toEqual([]);
  });

  it("requires each independent Copilot update capability and keeps the claim on refusal", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const withoutUpdate: NativePluginActivator = {
      isAvailable: () => true,
      addMarketplace: (source, scope) => activator.addMarketplace(source, scope),
      enablesPlugins: () => activator.enablesPlugins(),
      removeMarketplace: (name, scope) => activator.removeMarketplace(name, scope),
      registrationState: () => activator.registrationState(),
      upgradeMarketplaces: () => activator.upgradeMarketplaces(),
      enablePlugin: (ref, scope) => activator.enablePlugin(ref, scope),
      uninstallPlugin: (ref, scope) => activator.uninstallPlugin(ref, scope),
    };
    for (const gate of [
      new NativeHostRegistrationGate(new Map(), new Map([["copilot", reader(enabled())]])),
      new NativeHostRegistrationGate(
        new Map([["copilot", new FakeNativePluginActivator({ available: false })]]),
        new Map([["copilot", reader(enabled())]])
      ),
      new NativeHostRegistrationGate(
        new Map([["copilot", withoutUpdate]]),
        new Map([["copilot", reader(enabled())]])
      ),
      new NativeHostRegistrationGate(new Map([["copilot", activator]]), new Map()),
    ]) {
      await expect(gate.requireTargetedUpdate("copilot", claim, "/A")).rejects.toThrow(
        /without its CLI and readable host registry/
      );
    }
    for (const registry of [
      reader(),
      reader(new Map()),
      reader(new Map([[REF, { enabled: false }]])),
    ]) {
      const gate = new NativeHostRegistrationGate(
        new Map([["copilot", activator]]),
        new Map([["copilot", registry]])
      );
      await expect(gate.requireTargetedUpdate("copilot", claim, "/A")).rejects.toThrow(
        /not provably enabled/
      );
    }
    const gate = new NativeHostRegistrationGate(
      new Map([["copilot", activator]]),
      new Map([["copilot", reader(enabled())]])
    );
    expect(await gate.requireTargetedUpdate("copilot", claim, "/A")).toBe(activator);
  });

  it("refuses catalogue removal unless CLI, registry, and every owned ref are proven", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const registration = registrations.marketplaces[0];
    for (const gate of [
      new NativeHostRegistrationGate(new Map(), new Map([["copilot", reader(enabled())]])),
      new NativeHostRegistrationGate(
        new Map([["copilot", new FakeNativePluginActivator({ available: false })]]),
        new Map([["copilot", reader(enabled())]])
      ),
      new NativeHostRegistrationGate(new Map([["copilot", activator]]), new Map()),
    ]) {
      await expect(
        gate.planMarketplaceRemoval("copilot", registrations, registration, "/A")
      ).rejects.toThrow(/CLI or host registry unavailable/);
    }
    for (const registry of [
      reader(),
      reader(new Map()),
      reader(new Map([[REF, { enabled: false }]])),
    ]) {
      const gate = new NativeHostRegistrationGate(
        new Map([["copilot", activator]]),
        new Map([["copilot", registry]])
      );
      await expect(
        gate.planMarketplaceRemoval("copilot", registrations, registration, "/A")
      ).rejects.toThrow(/host registry|still enabled/);
    }
  });

  it("does not adopt a foreign same-catalogue ref, and returns only exact owned host scopes", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const host = new Map<string, { enabled: boolean; scope?: "project" | "user" }>(enabled());
    host.set("foreign@real-catalog", { enabled: true, scope: "project" });
    const gate = new NativeHostRegistrationGate(
      new Map([["copilot", activator]]),
      new Map([["copilot", reader(host)]])
    );
    await expect(
      gate.planMarketplaceRemoval("copilot", registrations, registrations.marketplaces[0], "/A")
    ).rejects.toThrow(/foreign host ref 'foreign@real-catalog'/);
    const safe = new NativeHostRegistrationGate(
      new Map([["copilot", activator]]),
      new Map([["copilot", reader(enabled())]])
    );
    expect(
      await safe.planMarketplaceRemoval(
        "copilot",
        registrations,
        registrations.marketplaces[0],
        "/A"
      )
    ).toMatchObject({ activator, refs: [claim] });
    const plan = await safe.planMarketplaceRemoval(
      "copilot",
      registrations,
      registrations.marketplaces[0],
      "/A"
    );
    expect(plan.scopes.get(REF)).toBe("user");
  });
});
