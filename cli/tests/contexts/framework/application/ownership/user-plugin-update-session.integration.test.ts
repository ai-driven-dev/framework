import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { expect, it, vi } from "vitest";
import { NativeHostRegistrationGate } from "../../../../../src/contexts/framework/application/ownership/native-host-registration-gate.js";
import type { PinnedUserFramework } from "../../../../../src/contexts/framework/application/ownership/release/pinned-user-framework.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../../../../../src/contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

it("uses one private session for all machine copies in sync and plugin update", async () => {
  const manifest = Manifest.create();
  for (const tool of ["opencode", "kilo"] as const) {
    manifest.addTool(tool, "5.0.0", []);
    for (const name of ["aidd-context", "aidd-dev"]) {
      const source = {
        kind: "git-subdir",
        url: "https://github.com/ai-driven-dev/framework.git",
        path: `plugins/${name}`,
        ref: "v5.13.0",
        sha: "a".repeat(40),
      } as const;
      manifest.addPlugin(
        tool,
        InstalledPlugin.fromMetadata(name, "1.0.0", source, false, "user", "aidd-framework")
      );
    }
  }
  const events: string[] = [];
  const session: PinnedUserFramework = {
    build: async () => {
      throw new Error("planning is mocked");
    },
  };
  const pinned: PinnedUserFramework = {
    build: session.build,
    async withSession<T>(action: (session: PinnedUserFramework) => Promise<T>): Promise<T> {
      events.push("opened");
      try {
        return await action(session);
      } finally {
        events.push("closed");
      }
    },
  };
  const fs = new InMemoryFileAdapter();
  const updater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(
      new FixturePluginFetcher(),
      new PluginDistributionReaderAdapter(fs)
    ),
    new DeterministicHasher(),
    {
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: new InMemoryMarketplaceRegistry(),
      homedir: () => "/home/user",
      pinnedFramework: pinned,
    }
  );
  const plan = vi.spyOn(updater, "planUpdate").mockResolvedValue(null);
  const useCase = new UserPluginUpdateUseCase(
    new InMemoryManifestRepository(manifest),
    updater,
    new CapturingLogger(),
    new NativeHostRegistrationGate(new Map(), new Map())
  );
  await useCase.execute({
    toolIds: ["opencode", "kilo"],
    projectRoot: "/project",
    scope: "user",
    rebuild: true,
  });
  await useCase.execute({ toolIds: ["opencode", "kilo"], projectRoot: "/project", scope: "user" });
  expect(plan).toHaveBeenCalledTimes(8);
  for (const tool of ["opencode", "kilo"])
    for (const name of ["aidd-context", "aidd-dev"]) {
      expect(plan).toHaveBeenCalledWith(
        expect.objectContaining({ name }),
        tool,
        "/project",
        expect.anything(),
        true,
        undefined,
        session
      );
      expect(plan).toHaveBeenCalledWith(
        expect.objectContaining({ name }),
        tool,
        "/project",
        expect.anything(),
        false,
        undefined,
        session
      );
    }
  expect(events).toEqual(["opened", "closed", "opened", "closed"]);
});
