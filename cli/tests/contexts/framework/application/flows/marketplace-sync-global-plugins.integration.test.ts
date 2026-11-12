import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import type { HostPluginRegistryEntry } from "../../../../../src/contexts/host-registration/contract/host-plugin-registry.js";
import type { MarketplaceScope } from "../../../../../src/kernel/scope.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { FakeHostActions } from "../../../host-registration/testing/fake-host-actions.js";
import { FakeHostMarketplaceRegistry } from "../../../host-registration/testing/fake-host-marketplace-registry.js";
import { FakeHostMarketplaceSources } from "../../../host-registration/testing/fake-host-marketplace-sources.js";
import { FakeHostPluginRegistry } from "../../../host-registration/testing/fake-host-plugin-registry.js";
import { registeredProfiles } from "../../../tools/testing/catalog-of.js";

const REF = "test-plugin@aidd-framework";

async function globalActivation(toolId: "claude" | "copilot") {
  const refs = new Map<string, HostPluginRegistryEntry>();
  class StatefulActivator extends FakeHostActions {
    override enablePlugin(ref: string, scope: MarketplaceScope = "project"): void {
      super.enablePlugin(ref, scope);
      refs.set(ref, { enabled: true, scope });
    }
  }
  const activator = new StatefulActivator({ available: true });
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  const userRepo = new InMemoryManifestRepository(machine);
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    "/project",
    Marketplace.create({
      name: "aidd-framework",
      source: { kind: "local", path: "/source" },
      scope: "user",
      addedAt: "2026-09-15T00:00:00Z",
    })
  );
  const builtDir = `/built/${toolId}`;
  const catalogDir = toolId === "claude" ? ".claude-plugin" : ".plugin";
  const fs = new InMemoryFileAdapter({
    [`${builtDir}/${catalogDir}/marketplace.json`]: JSON.stringify({
      name: "aidd-framework",
      plugins: [{ name: "test-plugin" }],
    }),
  });
  const sync = new MarketplaceSyncSettingsUseCase(
    fs,
    new InMemoryManifestRepository(Manifest.create()),
    registry,
    new DeterministicHasher(),
    new CapturingLogger(),
    new Map([[toolId, activator]]),
    fakeEnsureBuiltMarketplace(),
    new Map([
      ["claude", new FakeHostMarketplaceRegistry({ location: "catalogues", entries: new Map() })],
    ]),
    () => "",
    undefined,
    undefined,
    undefined,
    new Map([[toolId, new FakeHostPluginRegistry({ location: "plugins", refs })]]),
    userRepo,
    new Map([
      [
        toolId,
        new FakeHostMarketplaceSources(
          activator,
          toolId === "claude" ? "registry" : "effective-list",
          (path) => (path === builtDir ? "aidd-framework" : undefined),
          new Map()
        ),
      ],
    ])
  );
  const options = { projectRoot: "/project", scope: "user" as const, manifestRepo: userRepo };
  const setup = await sync.execute({
    tools: registeredProfiles(),
    ...options,
    enablePlugins: ["test-plugin"],
  });
  expect(setup.errors).toEqual([]);
  expect(setup.warnings).toEqual([]);
  expect(userRepo.getCurrent()?.getPlugins(toolId)).toEqual([]);
  expect(userRepo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([REF]);
  return { refs, activator, userRepo, sync, options };
}

describe.each(["claude", "copilot"] as const)("global %s native plugins", (toolId) => {
  it.each(["enabled", "missing", "disabled", "claims only"] as const)(
    "sync retains and restores a successful selection when the ref is %s",
    async (state) => {
      const { refs, activator, userRepo, sync, options } = await globalActivation(toolId);
      if (state === "missing") refs.delete(REF);
      if (state === "disabled") refs.set(REF, { enabled: false, scope: "user" });
      if (state === "claims only") {
        const manifest = await userRepo.load();
        const registrations = manifest?.getNativeRegistrations(toolId);
        if (manifest === null || registrations === undefined)
          throw new Error("missing setup record");
        manifest.setNativeRegistrations(toolId, { ...registrations, pluginRefs: [] });
        await userRepo.save(manifest);
        refs.delete(REF);
      }

      const result = await sync.execute({ ...options, tools: registeredProfiles() });

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(refs.get(REF)?.enabled).toBe(true);
      expect(userRepo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([REF]);
      expect(userRepo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
      expect(activator.enabledPluginScopes).toEqual(
        state === "enabled" ? ["user"] : ["user", "user"]
      );
    }
  );
});
