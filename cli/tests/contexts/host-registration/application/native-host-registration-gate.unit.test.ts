import { describe, expect, it } from "vitest";
import { NativeHostRegistrationGate } from "../../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import type { HostMarketplaceSources } from "../../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { NativeRegistrations } from "../../../../src/contexts/installation/domain/manifest/native-registrations.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";
import { FakeHostActions } from "../testing/fake-host-actions.js";

const { copilot, codex } = TOOL;

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
  it("refuses removal when the canonical catalogue is absent on the host", async () => {
    const activator = new FakeHostActions({ available: true });
    const gate = new NativeHostRegistrationGate(
      new Map([[copilot, activator]]),
      new Map([
        [
          copilot,
          {
            read: async () => ({
              location: "/registry",
              refs: new Map([[REF, { enabled: true }]]),
            }),
          },
        ],
      ]),
      new Map([[copilot, { read: async () => ({ location: "/catalogue", entries: new Map() }) }]])
    );
    await expect(
      gate.planMarketplaceRemoval(
        registeredTools().aiProfile(copilot),
        registrations,
        registrations.marketplaces[0],
        "/A"
      )
    ).rejects.toThrow("copilot: catalogue source unproven.");
    expect(activator.removedMarketplaces).toEqual([]);
  });

  it("plans removal of an owned empty catalogue without inventing plugin claims", async () => {
    const registration = {
      alias: "alias",
      hostName: HOST,
      provenance: { kind: "registry" as const, source: "/owned/source" },
    };
    const activator = new FakeHostActions({ available: true });
    const gate = new NativeHostRegistrationGate(
      new Map([[copilot, activator]]),
      new Map([[copilot, { read: async () => ({ location: "/registry", refs: new Map() }) }]]),
      new Map([
        [
          copilot,
          {
            read: async () => ({
              location: "/catalogue",
              entries: new Map([[HOST, registration.provenance]]),
            }),
          },
        ],
      ])
    );
    const plan = await gate.planMarketplaceRemoval(
      registeredTools().aiProfile(copilot),
      { binary: "copilot", marketplaces: [registration], pluginRefs: [] },
      registration,
      "/A"
    );
    expect(plan.refs).toEqual([]);
    expect(plan.scopes).toEqual(new Map());
    expect(plan.activator).toBe(activator);
  });

  const provenCodex = {
    binary: "codex",
    marketplaces: [
      {
        alias: "alias",
        hostName: HOST,
        provenance: {
          kind: "effective-list" as const,
          root: "/home/.codex/plugins/marketplaces/real-catalog",
          sourceType: "local",
          source: "/project-a/.aidd/cache/built",
        },
      },
    ],
    pluginRefs: [REF],
    pluginClaims: [claim],
  } satisfies NativeRegistrations;
  const hostSource = (source: string): HostMarketplaceSources => ({
    read: async () => ({
      location: "codex plugin marketplace list --json",
      entries: new Map([[HOST, { ...provenCodex.marketplaces[0].provenance, source }]]),
    }),
  });
  const reader = (refs?: ReadonlyMap<string, { enabled: boolean; scope?: "user" | "project" }>) =>
    ({
      read: async () => ({ location: "/host/registry", refs }),
    }) satisfies HostPluginRegistry;
  const enabled = () => new Map([[REF, { enabled: true, scope: "user" as const }]]);

  it("refuses a Codex removal when a stale canonical claim points at a foreign current source", async () => {
    const activator = new FakeHostActions({ available: true });
    const gate = new NativeHostRegistrationGate(
      new Map([[codex, activator]]),
      new Map([[codex, reader(enabled())]]),
      new Map([[codex, hostSource("/foreign/catalog")]])
    );

    await expect(
      gate.planMarketplaceRemoval(
        registeredTools().aiProfile(codex),
        provenCodex,
        provenCodex.marketplaces[0],
        "/project-b"
      )
    ).rejects.toThrow(/current host source differs.*reconcile manually/);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.uninstalledPlugins).toEqual([]);
  });

  it("refuses a legacy Codex claim without exact source even if refs are enabled", async () => {
    const activator = new FakeHostActions({ available: true });
    const gate = new NativeHostRegistrationGate(
      new Map([[codex, activator]]),
      new Map([[codex, reader(enabled())]]),
      new Map([[codex, hostSource(provenCodex.marketplaces[0].provenance.source)]])
    );

    await expect(
      gate.planMarketplaceRemoval(
        registeredTools().aiProfile(codex),
        { ...provenCodex, marketplaces: [{ alias: "alias", hostName: HOST }] },
        { alias: "alias", hostName: HOST },
        "/project-b"
      )
    ).rejects.toThrow(/legacy claim has no source proof/);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  it("refuses catalogue removal unless CLI, registry, and every owned ref are proven", async () => {
    const activator = new FakeHostActions({ available: true });
    const registration = registrations.marketplaces[0];
    for (const gate of [
      new NativeHostRegistrationGate(new Map(), new Map([[copilot, reader(enabled())]])),
      new NativeHostRegistrationGate(
        new Map([[copilot, new FakeHostActions({ available: false })]]),
        new Map([[copilot, reader(enabled())]])
      ),
      new NativeHostRegistrationGate(new Map([[copilot, activator]]), new Map()),
    ]) {
      await expect(
        gate.planMarketplaceRemoval(
          registeredTools().aiProfile(copilot),
          registrations,
          registration,
          "/A"
        )
      ).rejects.toThrow(/CLI or host registry unavailable/);
    }
    for (const registry of [
      reader(),
      reader(new Map()),
      reader(new Map([[REF, { enabled: false }]])),
    ]) {
      const gate = new NativeHostRegistrationGate(
        new Map([[codex, activator]]),
        new Map([[codex, registry]]),
        new Map([[codex, hostSource(provenCodex.marketplaces[0].provenance.source)]])
      );
      await expect(
        gate.planMarketplaceRemoval(
          registeredTools().aiProfile(codex),
          provenCodex,
          provenCodex.marketplaces[0],
          "/A"
        )
      ).rejects.toThrow(/host plugin registry|still enabled/);
    }
  });

  it("does not adopt a foreign same-catalogue ref, and returns only exact owned host scopes", async () => {
    const activator = new FakeHostActions({ available: true });
    const host = new Map<string, { enabled: boolean; scope?: "project" | "user" }>(enabled());
    host.set("foreign@real-catalog", { enabled: true, scope: "project" });
    const gate = new NativeHostRegistrationGate(
      new Map([[codex, activator]]),
      new Map([[codex, reader(host)]]),
      new Map([[codex, hostSource(provenCodex.marketplaces[0].provenance.source)]])
    );
    await expect(
      gate.planMarketplaceRemoval(
        registeredTools().aiProfile(codex),
        provenCodex,
        provenCodex.marketplaces[0],
        "/A"
      )
    ).rejects.toThrow(/foreign host ref 'foreign@real-catalog'/);
    const safe = new NativeHostRegistrationGate(
      new Map([[codex, activator]]),
      new Map([[codex, reader(enabled())]]),
      new Map([[codex, hostSource(provenCodex.marketplaces[0].provenance.source)]])
    );
    expect(
      await safe.planMarketplaceRemoval(
        registeredTools().aiProfile(codex),
        provenCodex,
        provenCodex.marketplaces[0],
        "/A"
      )
    ).toMatchObject({ activator, refs: [claim] });
    const plan = await safe.planMarketplaceRemoval(
      registeredTools().aiProfile(codex),
      provenCodex,
      provenCodex.marketplaces[0],
      "/A"
    );
    expect(plan.scopes.get(REF)).toBe("user");
  });
});
