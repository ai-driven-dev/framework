import { describe, expect, it } from "vitest";
import type { RegistrationRecord } from "../../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { HostMarketplaceSources } from "../../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import {
  hostWithdrawal,
  proveMarketplaceRemoval,
} from "../../../shared/testing/host-withdrawal.builder.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";

const { copilot, codex } = TOOL;

const REF = "test-plugin@real-catalog";
const HOST = "real-catalog";
const registrations: RegistrationRecord = {
  binary: "copilot",
  marketplaces: [{ alias: "alias", hostName: HOST }],
  pluginRefs: [REF],
};

describe("proving a catalogue removal", () => {
  it("refuses removal when the canonical catalogue is absent on the host", async () => {
    const activator = new FakeHostActions({ available: true });
    const gate = hostWithdrawal(
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
      proveMarketplaceRemoval(gate, registeredTools().aiProfile(copilot), registrations, {
        registration: registrations.marketplaces[0],
        projectRoot: "/A",
        claimedRefs: [REF],
      })
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
    const gate = hostWithdrawal(
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
    const plan = await proveMarketplaceRemoval(
      gate,
      registeredTools().aiProfile(copilot),
      { binary: "copilot", marketplaces: [registration], pluginRefs: [] },
      { registration: registration, projectRoot: "/A", claimedRefs: [] }
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
  } satisfies RegistrationRecord;
  const hostSource = (source: string): HostMarketplaceSources => ({
    read: async () => ({
      location: "codex plugin marketplace list --json",
      entries: new Map([[HOST, { ...provenCodex.marketplaces[0].provenance, source }]]),
    }),
  });
  const reader = (refs?: ReadonlyMap<string, { enabled: boolean; scope?: Scope }>) =>
    ({
      read: async () => ({ location: "/host/registry", refs }),
    }) satisfies HostPluginRegistry;
  const enabled = () => new Map([[REF, { enabled: true, scope: "user" as const }]]);

  it("refuses a Codex removal when a stale canonical claim points at a foreign current source", async () => {
    const activator = new FakeHostActions({ available: true });
    const gate = hostWithdrawal(
      new Map([[codex, activator]]),
      new Map([[codex, reader(enabled())]]),
      new Map([[codex, hostSource("/foreign/catalog")]])
    );

    await expect(
      proveMarketplaceRemoval(gate, registeredTools().aiProfile(codex), provenCodex, {
        registration: provenCodex.marketplaces[0],
        projectRoot: "/project-b",
        claimedRefs: [REF],
      })
    ).rejects.toThrow(/current host source differs.*reconcile manually/);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.uninstalledPlugins).toEqual([]);
  });

  it("refuses a legacy Codex claim without exact source even if refs are enabled", async () => {
    const activator = new FakeHostActions({ available: true });
    const gate = hostWithdrawal(
      new Map([[codex, activator]]),
      new Map([[codex, reader(enabled())]]),
      new Map([[codex, hostSource(provenCodex.marketplaces[0].provenance.source)]])
    );

    await expect(
      proveMarketplaceRemoval(
        gate,
        registeredTools().aiProfile(codex),
        { ...provenCodex, marketplaces: [{ alias: "alias", hostName: HOST }] },
        {
          registration: { alias: "alias", hostName: HOST },
          projectRoot: "/project-b",
          claimedRefs: [REF],
        }
      )
    ).rejects.toThrow(/legacy claim has no source proof/);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  it("refuses catalogue removal unless CLI, registry, and every owned ref are proven", async () => {
    const activator = new FakeHostActions({ available: true });
    const registration = registrations.marketplaces[0];
    for (const gate of [
      hostWithdrawal(new Map(), new Map([[copilot, reader(enabled())]])),
      hostWithdrawal(
        new Map([[copilot, new FakeHostActions({ available: false })]]),
        new Map([[copilot, reader(enabled())]])
      ),
      hostWithdrawal(new Map([[copilot, activator]]), new Map()),
    ]) {
      await expect(
        proveMarketplaceRemoval(gate, registeredTools().aiProfile(copilot), registrations, {
          registration: registration,
          projectRoot: "/A",
          claimedRefs: [REF],
        })
      ).rejects.toThrow(/CLI or host registry unavailable/);
    }
  });

  it("does not adopt a foreign same-catalogue ref, and returns only exact owned host scopes", async () => {
    const activator = new FakeHostActions({ available: true });
    const host = new Map<string, { enabled: boolean; scope?: Scope }>(enabled());
    host.set("foreign@real-catalog", { enabled: true, scope: "project" });
    const gate = hostWithdrawal(
      new Map([[codex, activator]]),
      new Map([[codex, reader(host)]]),
      new Map([[codex, hostSource(provenCodex.marketplaces[0].provenance.source)]])
    );
    await expect(
      proveMarketplaceRemoval(gate, registeredTools().aiProfile(codex), provenCodex, {
        registration: provenCodex.marketplaces[0],
        projectRoot: "/A",
        claimedRefs: [REF],
      })
    ).rejects.toThrow(/foreign host ref 'foreign@real-catalog'/);
    const safe = hostWithdrawal(
      new Map([[codex, activator]]),
      new Map([[codex, reader(enabled())]]),
      new Map([[codex, hostSource(provenCodex.marketplaces[0].provenance.source)]])
    );
    expect(
      await proveMarketplaceRemoval(safe, registeredTools().aiProfile(codex), provenCodex, {
        registration: provenCodex.marketplaces[0],
        projectRoot: "/A",
        claimedRefs: [REF],
      })
    ).toMatchObject({ activator, refs: [REF] });
    const plan = await proveMarketplaceRemoval(
      safe,
      registeredTools().aiProfile(codex),
      provenCodex,
      { registration: provenCodex.marketplaces[0], projectRoot: "/A", claimedRefs: [REF] }
    );
    expect(plan.scopes.get(REF)).toBe("user");
  });
});
