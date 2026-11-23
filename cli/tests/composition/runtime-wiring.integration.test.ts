import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  builtMaterializationDepsOf,
  cacheBuildFor,
  debugOnly,
  wireInstallation,
} from "../../src/composition/contexts/installation.js";
import { userScopeFileGuard } from "../../src/composition/contexts/machine-claims.js";
import { wireTools } from "../../src/composition/contexts/tools.js";
import { hostBinaryAvailableIn } from "../../src/composition/orchestration/doctor.js";
import { userScopeSyncOf } from "../../src/composition/orchestration/global.js";
import {
  askedFrom,
  detachClaimsOf,
  quietUserScopeFilesSafeToDelete,
  registerForFlow,
  wireMarketplace,
} from "../../src/composition/orchestration/marketplace.js";
import {
  pluginCacheDir,
  purgeCandidateResolverOf,
  withinUserScope,
} from "../../src/composition/orchestration/plugin.js";
import { wireBase } from "../../src/composition/shared.js";
import { Marketplace } from "../../src/contexts/distribution/domain/marketplace.js";
import { ProjectHooksMaterializer } from "../../src/contexts/installation/application/materialize/project-hooks-materializer.use-case.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { isStrictlyWithin } from "../../src/shared/domain/paths.model.js";
import { BundledAssetProviderAdapter } from "../../src/shared/infrastructure/asset-loader.js";
import { fakeBuildSources } from "../contexts/installation/testing/fake-build-sources.fake.js";
import { CapturingLogger } from "../shared/testing/capturing-logger.fake.js";
import { CapturingOutput } from "../shared/testing/capturing-output.fake.js";
import { catalogOf, registeredAiProfile } from "../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../shared/testing/seed-from-directory.builder.js";

describe("asking whether a host binary is available", () => {
  const available = hostBinaryAvailableIn(
    new Map([
      ["here", { isAvailable: () => true }],
      ["gone", { isAvailable: () => false }],
    ])
  );

  it("answers what the activator behind the binary answers", () => {
    expect(available("here")).toBe(true);
    expect(available("gone")).toBe(false);
  });

  it("answers no for a binary no activator drives", () => {
    expect(available("unknown")).toBe(false);
  });
});

describe("syncing the user scope", () => {
  it("syncs what it is handed, for the user scope", async () => {
    const execute = vi.fn().mockResolvedValue({ binaryMissing: [], errors: [] });
    const options = {
      projectRoot: "/project",
      toolIds: [TOOL.claude],
      enablePlugins: ["aidd-test"],
      tools: catalogOf(),
    };

    await userScopeSyncOf({ execute })(options);

    expect(execute).toHaveBeenCalledWith({ ...options, scope: "user" });
  });
});

describe("registering for a flow", () => {
  it("registers the source for the project and scope of the flow", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const source = { kind: "local" as const, repo: "", ref: undefined, path: "/marketplace" };

    await registerForFlow({ execute })({ projectRoot: "/project", scope: "user" }, source);

    expect(execute).toHaveBeenCalledWith({ projectRoot: "/project", scope: "user", source });
  });
});

describe("deleting quiet user-scope files", () => {
  it("leaves a file outside the user-scope directory in place without reporting it", async () => {
    const plugin = RecordedPlugin.fromJSON({
      name: "aidd-test",
      source: { kind: "local", path: "/some/path" },
      version: "1.0.0",
      strict: false,
      files: { "../escape.md": "0".repeat(32) },
      scope: "user",
    }).plugin;

    const safe = await quietUserScopeFilesSafeToDelete(new InMemoryFileAdapter())(
      plugin,
      registeredAiProfile(TOOL.cursor),
      "/home/u"
    );

    expect([...safe]).toStrictEqual([]);
  });
});

describe("the user marketplace removal the composition binds", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "aidd-user-removal-"));
    await mkdir(join(home, ".cursor", "plugins", "local"), { recursive: true });
    vi.stubEnv("HOME", home);
    vi.stubEnv("AIDD_USER_CONFIG_DIR", join(home, "config"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(home, { recursive: true, force: true });
  });

  it("refuses a plugin file outside the user-scope directory without logging why", async () => {
    const output = new CapturingOutput(false);
    const machine = Manifest.create();
    machine.addTool(TOOL.cursor, "1.0.0", []);
    machine.addPlugin(
      TOOL.cursor,
      RecordedPlugin.fromJSON({
        name: "aidd-test",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { "../escape.md": "0".repeat(32) },
        scope: "user",
        marketplace: "team",
      })
    );
    const base = {
      ...wireBase({ projectRoot: "/project", verbose: false, output, tools: registeredTools() }),
      nativePluginActivators: new Map(),
      hostPluginRegistries: new Map(),
      nativeSources: new Map(),
    };
    await base.userManifestRepo.save(machine);
    await base.marketplaceRegistry.save(
      "/project",
      Marketplace.create({
        name: "team",
        source: { kind: "github", repo: "org/team" },
        scope: "user",
        addedAt: "2026-09-01T00:00:00.000Z",
      })
    );

    const removal = wireMarketplace(base, wireInstallation(base)).userMarketplaceRemoveUseCase;
    await expect(
      removal.execute({ name: "team", projectRoot: "/project", autoConfirm: true, scope: "user" })
    ).rejects.toThrow("has a tracked file outside its boundary");

    expect(output.lines).toStrictEqual([]);
  });
});

describe("locating the plugin cache", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sits under the user configuration directory", () => {
    vi.stubEnv("AIDD_USER_CONFIG_DIR", join("/config", "aidd"));

    expect(pluginCacheDir()).toBe(join("/config", "aidd", "cache", "plugin-cache"));
  });
});

describe("updating within the user scope", () => {
  type Bound = ReturnType<typeof withinUserScope>;
  const plugin = {} as Parameters<Bound["planUpdate"]>[0]["plugin"];
  const tool = {} as Parameters<Bound["planUpdate"]>[0]["tool"];
  const logger = new CapturingLogger();

  it("plans an update with the containment rule bound, and without a rebuild unless asked", async () => {
    const planUpdate = vi.fn().mockResolvedValue(null);
    const bound = withinUserScope({ planUpdate, applyUpdate: vi.fn() });
    const request = { plugin, tool, projectRoot: "/project", logger };

    await bound.planUpdate(request);
    await bound.planUpdate({ ...request, rebuild: true });

    expect(planUpdate).toHaveBeenNthCalledWith(1, {
      ...request,
      rebuild: false,
      isWithinUserScope: isStrictlyWithin,
    });
    expect(planUpdate).toHaveBeenNthCalledWith(2, {
      ...request,
      rebuild: true,
      isWithinUserScope: isStrictlyWithin,
    });
  });

  it("applies an update with the containment rule bound", async () => {
    const applyUpdate = vi.fn().mockResolvedValue(plugin);
    const plan = {} as Parameters<Bound["applyUpdate"]>[0];

    await withinUserScope({ planUpdate: vi.fn(), applyUpdate }).applyUpdate(plan, logger);

    expect(applyUpdate).toHaveBeenCalledWith(plan, {
      logger,
      isWithinUserScope: isStrictlyWithin,
    });
  });
});

describe("building into the cache", () => {
  const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
  const COLLIDING = ".github/agents/aidd-test-code-reviewer.agent.md";
  const STALE = "stale content from a previous build";
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "aidd-cache-build-"));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("overwrites what a previous build left in the cache", async () => {
    const fs = new InMemoryFileAdapter();
    await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });
    fs.setFile(`${outDir}/.keep`, "");
    fs.setFile(`${outDir}/${COLLIDING}`, STALE);
    const build = cacheBuildFor(catalogOf(), {
      fs,
      assetProvider: new BundledAssetProviderAdapter(wireTools()),
      logger: new CapturingLogger(),
    })({ target: TOOL.copilot, mode: "flat", outDir });

    await build?.execute({ sourceDir: FIXTURE_DIR, outDir, target: TOOL.copilot });

    expect(fs.getFile(`${outDir}/${COLLIDING}`)).toContain("aidd-test-code-reviewer");
  });
});

describe("logging at debug level", () => {
  it("lands every level at debug", () => {
    const debug = vi.fn();
    const logger = debugOnly({ debug, info: vi.fn(), warn: vi.fn() });

    const cause = new Error("boom");
    logger.debug("d");
    logger.info("i");
    logger.warn("w", cause);

    expect(debug.mock.calls).toStrictEqual([["d", undefined], ["i"], ["w", cause]]);
  });
});

describe("materializing a built restore", () => {
  it("hands a restore the build it was given and the project hooks built over its file system", () => {
    const build = {
      ...fakeBuildSources(),
      marketplaceRegistry: new InMemoryMarketplaceRegistry(),
      homedir: () => "/home/u",
      platform: process.platform,
    };

    const deps = builtMaterializationDepsOf(new InMemoryFileAdapter(), build);

    expect(deps).toMatchObject(build);
    expect(deps.projectHooks).toBeInstanceOf(ProjectHooksMaterializer);
  });
});

describe("resolving a purge candidate", () => {
  it("resolves a candidate through the purge that owns the rule", async () => {
    const resolveCandidate = vi.fn().mockResolvedValue("/cache/x");

    const resolved = await purgeCandidateResolverOf({ execute: resolveCandidate })(
      "/cache",
      "x",
      "label"
    );

    expect(resolved).toBe("/cache/x");
    expect(resolveCandidate).toHaveBeenCalledWith("/cache", "x", "label");
  });
});

describe("guarding user-scope files", () => {
  it("names the two rules a machine-scope write is held to", () => {
    expect(Object.keys(userScopeFileGuard).sort()).toStrictEqual([
      "assertWriteBoundary",
      "safeToDelete",
    ]);
    for (const rule of Object.values(userScopeFileGuard)) expect(rule).toBeTypeOf("function");
  });
});

describe("detaching claims", () => {
  it("detaches the claims of what a removal summarized", async () => {
    const detachClaims = vi.fn().mockResolvedValue(undefined);
    const nativeRefs = new Map();
    const plugins: never[] = [];

    await detachClaimsOf({ detachClaims })("/project", { nativeRefs, plugins });

    expect(detachClaims).toHaveBeenCalledWith("/project", nativeRefs, plugins);
  });
});

describe("asking from the setup options", () => {
  it("asks the marketplace question with the options it is given", async () => {
    const execute = vi.fn().mockResolvedValue("answer");
    const options = { projectRoot: "/project" } as Parameters<ReturnType<typeof askedFrom>>[0];

    expect(await askedFrom({ execute })(options)).toBe("answer");
    expect(execute).toHaveBeenCalledWith(options);
  });
});
