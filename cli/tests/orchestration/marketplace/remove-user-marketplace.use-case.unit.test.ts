import { describe, expect, it, vi } from "vitest";
import type { NativeHostRegistrationGate } from "../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import type { PurgeMarketplacePlugins } from "../../../src/contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import {
  RemoveUserMarketplace,
  type RemoveUserMarketplaceDeps,
} from "../../../src/orchestration/marketplace/remove-user-marketplace.use-case.js";
import { syntheticToolProfile } from "../../contexts/translate/testing/synthetic-tool-profile.builder.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";

type PurgeCommand = Parameters<PurgeMarketplacePlugins["execute"]>[0];

const FOUND = { name: "market", scope: "user", fingerprint: "fp" } as const;
const REGISTRATION = { alias: "market", hostName: "aidd-market" };
const TARGET: Parameters<PurgeCommand["hostRemoval"]["plan"]>[0] = {
  tool: syntheticToolProfile(),
  registrations: {
    marketplaces: [REGISTRATION],
    pluginClaims: [
      { ref: "scoped@aidd-market", dependents: [] },
      { ref: "unscoped@aidd-market", dependents: [] },
    ],
  },
  registration: REGISTRATION,
};

function removerWith(purge: (command: PurgeCommand) => Promise<number>) {
  const records: RemoveUserMarketplaceDeps["records"] = {
    marketplaceOf: vi.fn(() => REGISTRATION),
    holdersOf: vi.fn(() => []),
    claimedRefs: vi.fn(() => ["scoped@aidd-market", "unscoped@aidd-market"]),
    claimsOnMarketplace: vi.fn(() => []),
    withoutMarketplace: vi.fn((record) => ({ ...record, pluginClaims: [] })),
  };
  const find = { execute: vi.fn().mockResolvedValue(FOUND) };
  const remove = { execute: vi.fn().mockResolvedValue(undefined) };
  const activator = new FakeHostActions();
  const hostGate: Pick<NativeHostRegistrationGate, "planMarketplaceRemoval"> = {
    planMarketplaceRemoval: async (_tool, _registrations, { claimedRefs }) => ({
      activator,
      refs: claimedRefs,
      scopes: new Map([["scoped@aidd-market", "project"]]),
    }),
  };
  const plan = vi.spyOn(hostGate, "planMarketplaceRemoval");
  const useCase = new RemoveUserMarketplace({
    find,
    purge: { execute: purge },
    remove,
    hostGate,
    home: "/home",
    records,
  });
  return { useCase, find, remove, plan, activator, records };
}

describe("RemoveUserMarketplace", () => {
  it("purges what the machine holds for the marketplace it found, under the machine home", async () => {
    const purge = vi.fn().mockResolvedValue(3);
    const { useCase } = removerWith(purge);

    const result = await useCase.execute({
      name: "market",
      projectRoot: "/project",
      autoConfirm: true,
    });

    expect(purge).toHaveBeenCalledWith(
      expect.objectContaining({ marketplace: "market", projectRoot: "/project", home: "/home" })
    );
    expect(result).toEqual({ marketplace: FOUND, removedPluginCount: 3, orphanCount: 0 });
  });

  it("proves under the lock that the marketplace is still the one it found", async () => {
    const purge = vi.fn(async (command: PurgeCommand) => {
      await command.whileLocked();
      return 0;
    });
    const { useCase, find } = removerWith(purge);

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: true });

    expect(find.execute).toHaveBeenLastCalledWith({
      name: "market",
      projectRoot: "/project",
      unchangedSince: "fp",
    });
  });

  it("forgets the marketplace only when the purge asks for it", async () => {
    const purge = vi.fn(async (command: PurgeCommand) => {
      await command.forget();
      return 0;
    });
    const { useCase, remove } = removerWith(purge);
    expect(remove.execute).not.toHaveBeenCalled();

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: true });

    expect(remove.execute).toHaveBeenCalledWith({ projectRoot: "/project", marketplace: FOUND });
  });

  it("plans the host removal of a recorded catalogue for this project", async () => {
    const purge = vi.fn(async (command: PurgeCommand) => {
      await command.hostRemoval.plan(TARGET);
      return 0;
    });
    const { useCase, plan, activator } = removerWith(purge);

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: true });

    expect(plan).toHaveBeenCalledWith(TARGET.tool, TARGET.registrations, {
      registration: REGISTRATION,
      projectRoot: "/project",
      claimedRefs: ["scoped@aidd-market", "unscoped@aidd-market"],
    });
    expect(activator.uninstalledPlugins).toStrictEqual([]);
  });

  it("uninstalls each planned ref at its host scope, the user scope when unnamed, then the catalogue", async () => {
    const calls: string[] = [];
    const purge = vi.fn(async (command: PurgeCommand) => {
      command.hostRemoval.apply(await command.hostRemoval.plan(TARGET));
      return 0;
    });
    const { useCase, activator } = removerWith(purge);
    vi.spyOn(activator, "uninstallPlugin").mockImplementation((ref, scope) => {
      calls.push(`${ref}:${scope}`);
    });
    vi.spyOn(activator, "removeMarketplace").mockImplementation((name, scope) => {
      calls.push(`${name}:${scope}`);
    });

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: true });

    expect(calls).toStrictEqual([
      "scoped@aidd-market:project",
      "unscoped@aidd-market:user",
      "aidd-market:user",
    ]);
  });

  it("reads and drops the catalogue in each record through the host registration's rules", async () => {
    let records: PurgeCommand["records"] | undefined;
    const { useCase, records: rules } = removerWith(async (command) => {
      records = command.records;
      return 0;
    });

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: true });
    const record = { marketplaces: [REGISTRATION] };

    expect(records?.registrationOf(record, "market")).toStrictEqual(REGISTRATION);
    expect(records?.claimsOn(record, "market")).toStrictEqual([]);
    expect(records?.withoutMarketplace(record, "market")).toStrictEqual({
      ...record,
      pluginClaims: [],
    });
    expect(rules.marketplaceOf).toHaveBeenCalledWith(record, "market");
    expect(rules.claimsOnMarketplace).toHaveBeenCalledWith(record, "market");
    expect(rules.withoutMarketplace).toHaveBeenCalledWith(record, "market");
  });

  it("purges nothing when the marketplace is not found", async () => {
    const purge = vi.fn();
    const { useCase, find } = removerWith(purge);
    find.execute.mockRejectedValue(new Error("not found"));

    await expect(
      useCase.execute({ name: "ghost", projectRoot: "/project", autoConfirm: true })
    ).rejects.toThrow("not found");
    expect(purge).not.toHaveBeenCalled();
  });
});
