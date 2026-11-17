import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { UserRegistrationWithdrawal } from "../../../../src/contexts/host-registration/application/withdraw-from-host.js";
import { WithdrawFromHost } from "../../../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { HostMarketplaceRegistry } from "../../../../src/contexts/host-registration/ports/host-marketplace-registry.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { catalogOf, TOOL } from "../../tools/testing/catalog-of.js";
import { FakeHostActions } from "../testing/fake-host-actions.js";
import { FakeHostMarketplaceRegistry } from "../testing/fake-host-marketplace-registry.js";

const CACHE_ROOT = "/cache";
const HOST_NAME = "aidd-framework";
const CANDIDATE = join(CACHE_ROOT, HOST_NAME);
const LOCATION = "/host/known_marketplaces.json";

function userWithdrawal(cacheRoot: string | undefined): UserRegistrationWithdrawal {
  return {
    tool: catalogOf().aiProfile(TOOL.claude),
    registrations: {
      binary: "claude",
      marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME }],
      pluginRefs: [],
    },
    cacheRoot,
    claimedRefs: [],
  };
}

async function withdrawUser(
  fs: InMemoryFileAdapter,
  logger: CapturingLogger,
  reader: HostMarketplaceRegistry | undefined,
  cacheRoot: string | null = CACHE_ROOT
): Promise<void> {
  const withdraw = new WithdrawFromHost(fs, logger, {
    activators: new Map([["claude", new FakeHostActions({ available: true })]]),
    pluginRegistries: new Map(),
    marketplaceRegistries: reader === undefined ? new Map() : new Map([[TOOL.claude, reader]]),
    sources: new Map(),
  });
  await withdraw.withdrawUserRegistrations(
    [userWithdrawal(cacheRoot ?? undefined)],
    async (root, segment) => join(root, segment)
  );
}

describe("withdrawing a marketplace from its host, then its cache", () => {
  it("keeps the cache and names the registry that still owns its tenant", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "still registered" });
    const logger = new CapturingLogger();
    const reader = new FakeHostMarketplaceRegistry({
      location: LOCATION,
      entries: new Map([[HOST_NAME, "/another-project/marketplace"]]),
    });

    await withdrawUser(fs, logger, reader);

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

    await withdrawUser(fs, logger, reader);

    expect(fs.listAll()).toStrictEqual([neighbor.replaceAll("\\", "/")]);
    expect(logger.infoMessages).toContain(`claude: cache for '${HOST_NAME}' purged: ${CANDIDATE}`);
  });

  it("keeps its cache and reports an unreadable registry instead of treating it as empty", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "unproven ownership" });
    const logger = new CapturingLogger();

    await withdrawUser(
      fs,
      logger,
      new FakeHostMarketplaceRegistry({ location: LOCATION, unreadable: "EACCES" })
    );

    expect(fs.getFile(path)).toBe("unproven ownership");
    expect(logger.warnMessages).toStrictEqual([
      `claude: plugin cache left in place, its registry could not be read: ${LOCATION}`,
    ]);
  });

  it("purges the cache once the host's registry is gone", async () => {
    const fs = new InMemoryFileAdapter({ [join(CANDIDATE, "plugin.json")]: "{}" });

    await withdrawUser(
      fs,
      new CapturingLogger(),
      new FakeHostMarketplaceRegistry({ location: LOCATION, absent: true })
    );

    expect(fs.listAll()).toStrictEqual([]);
  });

  it("looks at no cache for a host that keeps none", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "{}" });
    const logger = new CapturingLogger();

    await withdrawUser(fs, logger, undefined, null);

    expect(fs.getFile(path)).toBe("{}");
    expect(logger.warnMessages).toStrictEqual([]);
  });
});
