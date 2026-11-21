import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  builtMaterializationDepsOf,
  cacheBuildFor,
  debugOnly,
  wireInstallation,
} from "../../src/composition/installation.js";
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
  userScopeFileGuard,
  withinUserScope,
} from "../../src/composition/orchestration/plugin.js";
import { setupQuestionsOf, setupStepsOf } from "../../src/composition/orchestration/setup.js";
import { wireBase } from "../../src/composition/shared.js";
import { wireTools } from "../../src/composition/tools.js";
import { Marketplace } from "../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { isStrictlyWithinUserScope } from "../../src/contexts/machine-claims/domain/user-scope-containment.js";
import { BundledAssetProviderAdapter } from "../../src/shared/infrastructure/asset-loader.js";
import { CapturingLogger } from "../shared/testing/capturing-logger.fake.js";
import { CapturingOutput } from "../shared/testing/capturing-output.fake.js";
import { catalogOf, registeredAiProfile } from "../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../shared/testing/seed-from-directory.builder.js";

describe("hostBinaryAvailableIn", () => {
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

describe("userScopeSyncOf", () => {
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

describe("registerForFlow", () => {
  it("registers the source for the project and scope of the flow", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const source = { kind: "local" as const, repo: "", ref: undefined, path: "/marketplace" };

    await registerForFlow({ execute })({ projectRoot: "/project", scope: "user" }, source);

    expect(execute).toHaveBeenCalledWith({ projectRoot: "/project", scope: "user", source });
  });
});

describe("quietUserScopeFilesSafeToDelete", () => {
  it("leaves a file outside the user-scope directory in place without reporting it", async () => {
    const plugin = InstalledPlugin.fromJSON({
      name: "aidd-test",
      source: { kind: "local", path: "/some/path" },
      version: "1.0.0",
      strict: false,
      files: { "../escape.md": "0".repeat(32) },
      scope: "user",
    });

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
      InstalledPlugin.fromJSON({
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

describe("pluginCacheDir", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sits under the user configuration directory", () => {
    vi.stubEnv("AIDD_USER_CONFIG_DIR", join("/config", "aidd"));

    expect(pluginCacheDir()).toBe(join("/config", "aidd", "cache", "plugin-cache"));
  });
});

describe("withinUserScope", () => {
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
      isWithinUserScope: isStrictlyWithinUserScope,
    });
    expect(planUpdate).toHaveBeenNthCalledWith(2, {
      ...request,
      rebuild: true,
      isWithinUserScope: isStrictlyWithinUserScope,
    });
  });

  it("applies an update with the containment rule bound", async () => {
    const applyUpdate = vi.fn().mockResolvedValue(plugin);
    const plan = {} as Parameters<Bound["applyUpdate"]>[0];

    await withinUserScope({ planUpdate: vi.fn(), applyUpdate }).applyUpdate(plan, logger);

    expect(applyUpdate).toHaveBeenCalledWith(plan, {
      logger,
      isWithinUserScope: isStrictlyWithinUserScope,
    });
  });
});

describe("cacheBuildFor", () => {
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

type Guards = Parameters<typeof setupStepsOf>[2];
type Base = Parameters<typeof setupStepsOf>[0];
type Questions = ReturnType<typeof setupQuestionsOf>;

describe("debugOnly", () => {
  it("lands every level at debug", () => {
    const debug = vi.fn();
    const logger = debugOnly({ debug, info: vi.fn(), warn: vi.fn() });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");

    expect(debug.mock.calls).toStrictEqual([["d"], ["i"], ["w"]]);
  });
});

describe("builtMaterializationDepsOf", () => {
  it("hands a restore the build, the registry, the home directory resolver, the translation and the platform", () => {
    const ensureBuilt = {} as Parameters<typeof builtMaterializationDepsOf>[0];
    const marketplaceRegistry = {} as Parameters<typeof builtMaterializationDepsOf>[1];
    const translate = {} as Parameters<typeof builtMaterializationDepsOf>[2];

    expect(builtMaterializationDepsOf(ensureBuilt, marketplaceRegistry, translate)).toStrictEqual({
      ensureBuilt,
      marketplaceRegistry,
      homedir,
      translate,
      platform: process.platform,
    });
  });
});

describe("purgeCandidateResolverOf", () => {
  it("resolves a candidate through the purge that owns the rule", async () => {
    const resolveCandidate = vi.fn().mockResolvedValue("/cache/x");

    const resolved = await purgeCandidateResolverOf({ resolveCandidate })("/cache", "x", "label");

    expect(resolved).toBe("/cache/x");
    expect(resolveCandidate).toHaveBeenCalledWith("/cache", "x", "label");
  });
});

describe("userScopeFileGuard", () => {
  it("names the three rules a machine-scope write is held to", () => {
    expect(Object.keys(userScopeFileGuard).sort()).toStrictEqual([
      "assertWriteBoundary",
      "safeToDelete",
      "withoutMissing",
    ]);
    for (const rule of Object.values(userScopeFileGuard)) expect(rule).toBeTypeOf("function");
  });
});

describe("detachClaimsOf", () => {
  it("detaches the claims of what a removal summarized", async () => {
    const detachClaims = vi.fn().mockResolvedValue(undefined);
    const nativeRefs = new Map();
    const plugins: never[] = [];

    await detachClaimsOf({ detachClaims })("/project", { nativeRefs, plugins });

    expect(detachClaims).toHaveBeenCalledWith("/project", nativeRefs, plugins);
  });
});

describe("askedFrom", () => {
  it("asks the marketplace question with the options it is given", async () => {
    const execute = vi.fn().mockResolvedValue("answer");
    const options = { projectRoot: "/project" } as Parameters<ReturnType<typeof askedFrom>>[0];

    expect(await askedFrom({ execute })(options)).toBe("answer");
    expect(execute).toHaveBeenCalledWith(options);
  });
});

describe("setupStepsOf", () => {
  const resolveSource = { execute: vi.fn() };
  const register = vi.fn();
  const installTools = {} as Guards["setupToolsUseCase"];
  const detectContext = {} as Guards["projectContextDetector"];
  const machineScope = {} as Guards["setupMachineScope"];
  const version = {} as Base["currentVersionProvider"];

  it("names each stage after what runs it", () => {
    const steps = setupStepsOf(
      { currentVersionProvider: version },
      {
        resolveSetupSource: resolveSource,
        registerSetupSource: register,
        syncSettingsUseCase: { execute: vi.fn() },
      },
      {
        setupToolsUseCase: installTools,
        projectContextDetector: detectContext,
        setupMachineScope: machineScope,
      }
    );

    expect(steps).toMatchObject({
      resolveSource,
      register,
      installTools,
      version,
      detectContext,
      machineScope,
    });
  });

  it("syncs settings through the marketplace's sync", async () => {
    const execute = vi.fn().mockResolvedValue({ binaryMissing: [], errors: [] });
    const steps = setupStepsOf(
      { currentVersionProvider: version },
      {
        resolveSetupSource: resolveSource,
        registerSetupSource: register,
        syncSettingsUseCase: { execute },
      },
      {
        setupToolsUseCase: installTools,
        projectContextDetector: detectContext,
        setupMachineScope: machineScope,
      }
    );
    const options = { projectRoot: "/project", tools: catalogOf() };

    await steps.syncSettings(options);

    expect(execute).toHaveBeenCalledWith(options);
  });
});

describe("setupQuestionsOf", () => {
  it("asks the plugin and tool questions through the prompts that own them", async () => {
    const plugins = vi.fn().mockResolvedValue("p");
    const tools = vi.fn().mockResolvedValue("t");
    const questions = setupQuestionsOf({ execute: plugins }, { execute: tools });
    const pluginOptions = { projectRoot: "/project" } as Parameters<Questions["plugins"]>[0];
    const toolOptions = { interactive: false } as NonNullable<
      Parameters<NonNullable<Questions["tools"]>>[0]
    >;

    expect(await questions.plugins(pluginOptions)).toBe("p");
    expect(await questions.tools?.(toolOptions)).toBe("t");
    expect(plugins).toHaveBeenCalledWith(pluginOptions);
    expect(tools).toHaveBeenCalledWith(toolOptions);
  });
});
