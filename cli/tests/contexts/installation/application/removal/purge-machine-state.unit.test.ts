import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../../src/contexts/distribution/contract/marketplace.js";
import {
  type MachineStateGuards,
  PurgeMachineState,
} from "../../../../../src/contexts/installation/application/removal/purge-machine-state.js";
import { PurgeDeclaredCache } from "../../../../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const CONFIG = "/fake-home/.config/aidd";
const ROOT = "/project";

function machineOver(fs: InMemoryFileAdapter, registry = new FakeMarketplaceRegistry()) {
  const logger = new CapturingLogger();
  const cache = new PurgeDeclaredCache(fs, logger);
  const guards: MachineStateGuards = {
    userConfigDir: () => CONFIG,
    resolveCacheCandidate: (cacheRoot, segments, label) =>
      cache.resolveCandidate(cacheRoot, segments, label),
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
  return new PurgeMachineState({ fs, logger, marketplaceRegistry: registry, guards });
}

describe("PurgeMachineState.builtVersions", () => {
  it("names each built version once, sorted", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(CONFIG, "cache", "built", "2.0.0", "a", "x"), "1");
    fs.setFile(join(CONFIG, "cache", "built", "1.2.3", "a", "x"), "1");
    fs.setFile(join(CONFIG, "cache", "built", "1.2.3", "b", "y"), "1");

    await expect(machineOver(fs).builtVersions()).resolves.toEqual(["1.2.3", "2.0.0"]);
  });

  it("names none when nothing was ever built", async () => {
    await expect(machineOver(new InMemoryFileAdapter()).builtVersions()).resolves.toEqual([]);
  });
});

describe("PurgeMachineState.purge", () => {
  it("removes the built cache and the self-update check, then the cache shell they emptied", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(CONFIG, "cache", "built", "1.0.0", "x"), "1");
    fs.setFile(join(CONFIG, "cache", "update-check.json"), "{}");

    await machineOver(fs).purge(ROOT);

    expect(await fs.isDirectory(join(CONFIG, "cache"))).toBe(false);
  });

  it("keeps the cache shell while another occupant still uses it", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(CONFIG, "cache", "built", "1.0.0", "x"), "1");
    fs.setFile(join(CONFIG, "cache", "other-tool", "keep"), "1");

    await machineOver(fs).purge(ROOT);

    expect(fs.has(join(CONFIG, "cache", "other-tool", "keep"))).toBe(true);
    expect(await fs.isDirectory(join(CONFIG, "cache", "built"))).toBe(false);
  });

  it("withdraws the framework marketplace's user registration", async () => {
    const registry = new FakeMarketplaceRegistry();
    registry.seed(ROOT, {
      name: FRAMEWORK_MARKETPLACE_NAME,
      source: { kind: "local", path: "/m" },
      scope: "user",
    });

    await machineOver(new InMemoryFileAdapter(), registry).purge(ROOT);

    expect(await registry.list(ROOT)).toEqual([]);
  });
});
