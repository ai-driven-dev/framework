import { describe, expect, it } from "vitest";
import type {
  ResolveMarketplace,
  ResolveMarketplaceRequest,
  ResolveMarketplaceResult,
} from "../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { CacheBuiltMarketplace } from "../../../src/contexts/installation/application/marketplace/cache-built-marketplace.use-case.js";
import type {
  EnsureBuiltMarketplaceRequest,
  EnsureBuiltMarketplaceResult,
  ResolvedMarketplace,
} from "../../../src/contexts/installation/contract/built-marketplace.js";
import { EnsureBuiltMarketplace } from "../../../src/orchestration/marketplace/ensure-built-marketplace.use-case.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

type RegisteredCommand = Parameters<EnsureBuiltMarketplace["execute"]>[0];

const PROJECT_ROOT = "/proj";
const EPOCH = "1970-01-01T00:00:00.000Z";

const marketplace = Marketplace.create({
  name: "aidd-framework",
  source: { kind: "local", path: "/src/framework" },
  scope: "project",
  addedAt: EPOCH,
});

const cacheResult: EnsureBuiltMarketplaceResult = {
  builtDir: "/proj/.aidd/cache/built/aidd-framework/codex",
  version: "1.0.0",
  rebuilt: true,
};

function commandOf(forceRefresh?: boolean): RegisteredCommand {
  return {
    projectRoot: PROJECT_ROOT,
    marketplace,
    target: SYNTHETIC_TOOL,
    mode: "marketplace",
    ...(forceRefresh === undefined ? {} : { forceRefresh }),
  };
}

function ensurerOf(journal: string[] = []) {
  const resolveCommands: ResolveMarketplaceRequest[] = [];
  const cacheCalls: { command: EnsureBuiltMarketplaceRequest; resolved: ResolvedMarketplace }[] =
    [];
  const resolution: ResolveMarketplaceResult = {
    marketplace,
    localPath: "/src/framework",
    catalog: { version: "1.0.0", plugins: [] },
  };
  const resolver = {
    execute: async (command: ResolveMarketplaceRequest) => {
      journal.push("resolve");
      resolveCommands.push(command);
      return resolution;
    },
  } satisfies Pick<ResolveMarketplace, "execute">;
  const cache = {
    execute: async (command: EnsureBuiltMarketplaceRequest, resolved: ResolvedMarketplace) => {
      journal.push("cache");
      cacheCalls.push({ command, resolved });
      return cacheResult;
    },
  } satisfies Pick<CacheBuiltMarketplace, "execute">;
  return {
    ensurer: new EnsureBuiltMarketplace(resolver, cache),
    resolveCommands,
    cacheCalls,
    resolution,
  };
}

describe("ensuring a built marketplace", () => {
  it.each([{ forceRefresh: true }, { forceRefresh: false }, { forceRefresh: undefined }])(
    "asks the resolver for exactly the marketplace, project and refresh flag ($forceRefresh)",
    async ({ forceRefresh }) => {
      const { ensurer, resolveCommands } = ensurerOf();

      await ensurer.execute(commandOf(forceRefresh));

      expect(resolveCommands).toStrictEqual([
        { marketplace, projectRoot: PROJECT_ROOT, forceRefresh },
      ]);
    }
  );

  it("hands the cache the original command and what the resolver returned", async () => {
    const { ensurer, cacheCalls, resolution } = ensurerOf();
    const command = commandOf(true);

    await ensurer.execute(command);

    expect(cacheCalls).toHaveLength(1);
    expect(cacheCalls[0]?.command).toBe(command);
    expect(cacheCalls[0]?.resolved).toBe(resolution);
  });

  it("returns the cache's result unchanged", async () => {
    const { ensurer } = ensurerOf();

    expect(await ensurer.execute(commandOf())).toBe(cacheResult);
  });

  it("resolves on every call, before the cache", async () => {
    const journal: string[] = [];
    const { ensurer } = ensurerOf(journal);

    await ensurer.execute(commandOf());
    await ensurer.execute(commandOf());

    expect(journal).toStrictEqual(["resolve", "cache", "resolve", "cache"]);
  });
});
