import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { purgeMarketplaceCaches } from "../../../../../src/contexts/host-registration/application/withdraw/purge-host-cache.js";
import { readRegistrationRecord } from "../../../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { HostMarketplaceRegistry } from "../../../../../src/contexts/host-registration/ports/host-marketplace-registry.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.js";

const CACHE_ROOT = "/cache";
const HOST_NAME = "aidd-framework";
const CANDIDATE = join(CACHE_ROOT, HOST_NAME);
const LOCATION = "/host/known_marketplaces.json";

async function purgeRemovedMarketplace(
  fs: InMemoryFileAdapter,
  logger: CapturingLogger,
  reader: HostMarketplaceRegistry | undefined,
  cacheRoot: string | null = CACHE_ROOT
): Promise<void> {
  const record = {
    binary: "claude",
    marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME }],
    pluginRefs: [],
  };
  const registrations = readRegistrationRecord(record);
  if (registrations === undefined) throw new Error("registration record unreadable");
  await purgeMarketplaceCaches(
    {
      fs,
      logger,
      ports: {
        activators: new Map(),
        pluginRegistries: new Map(),
        marketplaceRegistries: reader === undefined ? new Map() : new Map([[TOOL.claude, reader]]),
        sources: new Map(),
      },
    },
    [
      {
        withdrawal: {
          tool: registeredTools().aiProfile(TOOL.claude),
          registrations: record,
          cacheRoot: cacheRoot ?? undefined,
        },
        registrations,
        removedHostNames: new Set([HOST_NAME]),
      },
    ],
    async (root, segment) => join(root, segment)
  );
}

describe("purging a marketplace's cache once the host removed it", () => {
  it("keeps the cache and names the registry that still owns its tenant", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "still registered" });
    const logger = new CapturingLogger();
    const reader = new FakeHostMarketplaceRegistry({
      location: LOCATION,
      entries: new Map([[HOST_NAME, "/another-project/marketplace"]]),
    });

    await purgeRemovedMarketplace(fs, logger, reader);

    expect(fs.getFile(path)).toBe("still registered");
    expect(logger.warnMessages).toStrictEqual([
      `claude: cache for '${HOST_NAME}' left in place, ${LOCATION} still names it: ${CANDIDATE}`,
    ]);
  });

  it("purges only its tenant once a readable registry no longer names it", async () => {
    const neighbor = join(CACHE_ROOT, "another-marketplace", "plugin.json");
    const fs = new InMemoryFileAdapter({
      [join(CANDIDATE, "plugin.json")]: "removed tenant",
      [neighbor]: "other tenant",
    });
    const logger = new CapturingLogger();
    const reader = new FakeHostMarketplaceRegistry({
      location: LOCATION,
      entries: new Map([["another-marketplace", "/other-project/marketplace"]]),
    });

    await purgeRemovedMarketplace(fs, logger, reader);

    expect(fs.listAll()).toStrictEqual([neighbor.replaceAll("\\", "/")]);
    expect(logger.infoMessages).toContain(`claude: cache for '${HOST_NAME}' purged: ${CANDIDATE}`);
  });

  it("looks at no cache for a host that keeps none", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "{}" });
    const logger = new CapturingLogger();

    await purgeRemovedMarketplace(fs, logger, undefined, null);

    expect(fs.getFile(path)).toBe("{}");
    expect(logger.warnMessages).toStrictEqual([]);
  });
});
