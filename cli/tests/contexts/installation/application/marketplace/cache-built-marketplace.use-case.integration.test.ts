import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createFrameworkBuildUseCase } from "../../../../../src/composition/translate.js";
import type {
  ResolveMarketplace,
  ResolveMarketplaceRequest,
} from "../../../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import {
  CacheBuiltMarketplace,
  type FrameworkBuilds,
} from "../../../../../src/contexts/installation/application/marketplace/cache-built-marketplace.use-case.js";
import type { DeclaredMarketplace } from "../../../../../src/contexts/installation/ports/marketplace-sources.js";
import { EnsureBuiltMarketplace } from "../../../../../src/orchestration/marketplace/ensure-built-marketplace.use-case.js";
import { builtMarketplaceDir } from "../../../../../src/shared/domain/layout/aidd-layout.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import type { VersionReader } from "../../../../../src/shared/ports/version-reader.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";

const PROJECT = "/proj";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
const PLUGIN = "aidd-test";

const MINIMAL_MANIFEST_SCHEMA = {
  type: "object",
  required: ["name"],
  properties: { name: { type: "string" } },
};

function stubAssetProvider(): AssetProvider {
  return {
    loadConfigAsset: () => {
      throw new Error("not used");
    },
    loadSchema: (name) => (name === "plugin-manifest" ? MINIMAL_MANIFEST_SCHEMA : {}),
  };
}

function makeMarketplace(): DeclaredMarketplace {
  return {
    name: "aidd-framework",
    source: { kind: "local", path: "/src/framework" },
    scope: "project",
  };
}

function fakeResolve(
  localPath: string,
  version: string | undefined
): Pick<ResolveMarketplace, "execute"> {
  return {
    execute: async ({ marketplace }: ResolveMarketplaceRequest) => ({
      marketplace,
      localPath,
      catalog: version === undefined ? null : { version, plugins: [] },
    }),
  } satisfies Pick<ResolveMarketplace, "execute">;
}

type BuildFor = FrameworkBuilds["buildFor"];

/** Every target's build, with no variant unless one is named. */
function buildsOf(buildFor: BuildFor, variant?: string): FrameworkBuilds {
  return { variant: async () => variant, buildFor };
}

function fakeVersion(value: string): VersionReader {
  return { get: () => value };
}

const USER_CACHE_ROOT = "/user-cache";

/** The use case as production wires it: a resolver in front of the cache, the user cache and the
 * version fixed. */
function buildEnsurer(
  fs: InMemoryFileAdapter,
  resolveMarketplace: Pick<ResolveMarketplace, "execute">,
  builds: FrameworkBuilds,
  version: VersionReader = fakeVersion("5.0.0")
): EnsureBuiltMarketplace {
  const cache = new CacheBuiltMarketplace({
    fs,
    builds,
    version,
    userCacheRoot: () => USER_CACHE_ROOT,
  });
  return new EnsureBuiltMarketplace(resolveMarketplace, cache);
}

// outDir here is always builtMarketplaceDir(), an aidd-owned disposable cache, so a collision
// only means a previous build is still there. A real flat sink catches force flipping.
describe("force behavior at the cache-rebuild path", () => {
  it("overwrites a colliding file already present in the build cache instead of throwing FlatTargetExistsError", async () => {
    const memFs = new InMemoryFileAdapter();
    await seedFromDirectory(memFs, FIXTURE_DIR, { useAbsolutePaths: true });

    // resolve(): the seeded "stale cache" file must sit at the same key the resolved builtDir is
    // passed as outDir, or the in-memory fs's prefix check never finds it on win32.
    const builtDir = resolve(builtMarketplaceDir(PROJECT, "aidd-framework", "copilot"));
    const agentPath = `${builtDir}/.github/agents/${PLUGIN}-code-reviewer.agent.md`;
    memFs.setFile(agentPath, "stale cache content from a previous build");

    const realBuildFor: BuildFor = () => {
      const build = createFrameworkBuildUseCase(
        registeredTools(),
        { fs: memFs, assetProvider: stubAssetProvider(), logger: new CapturingLogger() },
        // force:true mirrors deps.ts wiring for every *:flat target
        { target: TOOL.copilot, mode: "flat", outDir: builtDir, force: true }
      );
      if (build === undefined) throw new Error("copilot declares no flat build contract");
      return build;
    };

    const uc = buildEnsurer(memFs, fakeResolve(FIXTURE_DIR, "1.0.0"), buildsOf(realBuildFor));

    const result = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.copilot,
      mode: "flat",
    });

    expect(result.rebuilt).toBe(true);
    expect(memFs.getFile(agentPath)).not.toBe("stale cache content from a previous build");
  });
});
