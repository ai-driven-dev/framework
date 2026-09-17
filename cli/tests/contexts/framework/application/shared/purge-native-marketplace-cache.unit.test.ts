import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  purgeAllNativeCaches,
  purgeNativeMarketplaceCache,
  type UndoneToolRegistrations,
} from "../../../../../src/contexts/framework/application/shared/purge-native-marketplace-cache.js";
import type { ToolId } from "../../../../../src/kernel/tool.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FakeHostMarketplaceRegistryReader } from "../../../../helpers/ports/fake-host-marketplace-registry-reader.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

const HOME = "/home/u";
const CACHE_ROOT = "/cache";
const HOST_NAME = "aidd-framework";
const CANDIDATE = join(CACHE_ROOT, HOST_NAME);

function undone(binary: string): UndoneToolRegistrations {
  return {
    registrations: {
      binary,
      marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME }],
      pluginRefs: [],
    },
    removedHostNames: new Set([HOST_NAME]),
  };
}

describe("purgeAllNativeCaches", () => {
  it("skips a tool whose profile declares no plugin cache", async () => {
    const fs = new InMemoryFileAdapter({ [join(HOME, ".cursor", "plugins", "a.json")]: "{}" });
    const logger = new CapturingLogger();

    await purgeAllNativeCaches(
      fs,
      logger,
      HOME,
      new Map(),
      new Map<ToolId, UndoneToolRegistrations>([["cursor", undone("cursor")]])
    );

    expect(logger.allMessages).toStrictEqual([]);
    expect(fs.listAll()).toStrictEqual([`${HOME}/.cursor/plugins/a.json`]);
  });
});

describe("purgeNativeMarketplaceCache", () => {
  it("keeps the cache and names the registry that still owns its tenant after a confirmed removal", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "still registered" });
    const logger = new CapturingLogger();
    const location = "/host/known_marketplaces.json";
    const reader = new FakeHostMarketplaceRegistryReader({
      location,
      entries: new Map([[HOST_NAME, "/another-project/marketplace"]]),
    });

    await purgeNativeMarketplaceCache(fs, logger, reader, CACHE_ROOT, "claude", HOST_NAME, true);

    expect(fs.getFile(path)).toBe("still registered");
    expect(reader.reads).toBe(1);
    expect(logger.infoMessages).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([
      `claude: cache for '${HOST_NAME}' left in place, ${location} still names it: ${CANDIDATE}`,
    ]);
  });

  it("purges only its tenant once a readable registry no longer names it", async () => {
    const neighborPath = join(CACHE_ROOT, "another-marketplace", "plugin.json");
    const fs = new InMemoryFileAdapter({
      [join(CANDIDATE, "plugin.json")]: "removed tenant",
      [neighborPath]: "other tenant",
    });
    const logger = new CapturingLogger();
    const reader = new FakeHostMarketplaceRegistryReader({
      location: "/host/known_marketplaces.json",
      entries: new Map([["another-marketplace", "/other-project/marketplace"]]),
    });

    await purgeNativeMarketplaceCache(fs, logger, reader, CACHE_ROOT, "claude", HOST_NAME, true);

    expect(fs.listAll()).toStrictEqual([neighborPath]);
    expect(fs.getFile(neighborPath)).toBe("other tenant");
    expect(reader.reads).toBe(1);
    expect(logger.warnMessages).toStrictEqual([]);
    expect(logger.infoMessages).toStrictEqual([
      `claude: cache for '${HOST_NAME}' purged: ${CANDIDATE}`,
    ]);
  });

  it("keeps its cache and reports the unreadable registry instead of treating it as empty", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "unproven ownership" });
    const logger = new CapturingLogger();
    const location = "/host/known_marketplaces.json";
    const reader = new FakeHostMarketplaceRegistryReader({ location, unreadable: "EACCES" });

    await purgeNativeMarketplaceCache(fs, logger, reader, CACHE_ROOT, "claude", HOST_NAME, true);

    expect(fs.getFile(path)).toBe("unproven ownership");
    expect(reader.reads).toBe(1);
    expect(logger.infoMessages).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([
      `claude: plugin cache left in place, its registry could not be read: ${location}`,
    ]);
  });

  it("keeps a machine-global catalogue's bytes when project clean did not unregister it, even if a registry reader says absent", async () => {
    const path = join(CANDIDATE, "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "B still needs these bytes" });
    const logger = new CapturingLogger();
    const reader = new FakeHostMarketplaceRegistryReader({
      location: "/host/registry",
      absent: true,
    });
    await purgeNativeMarketplaceCache(fs, logger, reader, CACHE_ROOT, "claude", HOST_NAME, false);
    expect(fs.getFile(path)).toBe("B still needs these bytes");
  });
  it("names the cache path when its real location escapes the cache root", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setSymlink(CANDIDATE, "/elsewhere");
    const logger = new CapturingLogger();

    await purgeNativeMarketplaceCache(fs, logger, undefined, CACHE_ROOT, "codex", HOST_NAME, true);

    expect(logger.warnMessages).toStrictEqual([
      `codex: cache path for '${HOST_NAME}' does not resolve inside ${CACHE_ROOT}; left in place: ${CANDIDATE}`,
    ]);
  });

  it("keeps and names a cache the host never confirmed removing, for a host without a registry", async () => {
    const logger = new CapturingLogger();

    await purgeNativeMarketplaceCache(
      new InMemoryFileAdapter(),
      logger,
      undefined,
      CACHE_ROOT,
      "codex",
      HOST_NAME,
      false
    );

    expect(logger.warnMessages).toStrictEqual([
      `codex: cache for '${HOST_NAME}' left in place, its own removal was not confirmed: ${CANDIDATE}`,
    ]);
  });

  it("purges the cache and says so once the host's registry is gone", async () => {
    const fs = new InMemoryFileAdapter({ [join(CANDIDATE, "plugin.json")]: "{}" });
    const logger = new CapturingLogger();
    const reader = new FakeHostMarketplaceRegistryReader({
      location: "/home/u/.claude/plugins/known_marketplaces.json",
      absent: true,
    });

    await purgeNativeMarketplaceCache(fs, logger, reader, CACHE_ROOT, "claude", HOST_NAME, true);

    expect(fs.listAll()).toStrictEqual([]);
    expect(logger.infoMessages).toStrictEqual([
      `claude: cache for '${HOST_NAME}' purged: ${CANDIDATE}`,
    ]);
  });
});
