import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindContainer, createContainer } from "../../src/composition/container.js";
import { wireInstallation } from "../../src/composition/installation.js";
import { wireMarketplace } from "../../src/composition/orchestration/marketplace.js";
import { createOutput, wireBase } from "../../src/composition/shared.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { ManifestRepositoryAdapter } from "../../src/contexts/installation/infrastructure/manifest-repository-adapter.js";
import type { Output } from "../../src/orchestration/domain/output.js";
import { SilentPrompterAdapter } from "../../src/presentation/terminal/silent-prompter.adapter.js";
import { BUILT_CACHE_SUBDIR } from "../../src/shared/domain/layout/aidd-layout.js";
import type { Scope } from "../../src/shared/domain/scope.js";
import { FakeHostMarketplaceSources } from "../contexts/host-registration/testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { FakeHostActions } from "../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../shared/testing/host-record-reading.builder.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.builder.js";

const graphOf = (
  projectRoot: string,
  options: Parameters<ReturnType<typeof bindContainer>>[1],
  output: Output | undefined,
  tools: ReturnType<typeof catalogOf>
) => bindContainer(tools)(projectRoot, options, output);

describe("the graph a container hands the commands", () => {
  const tools = catalogOf();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-deps-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("logs through the output it was handed", async () => {
    const output = createOutput(false);
    const withOutput = await mkdtemp(join(tmpdir(), "aidd-create-deps-output-"));
    try {
      expect((await graphOf(withOutput, { verbose: false }, output, tools)).logger).toBe(output);
    } finally {
      await rm(withOutput, { recursive: true, force: true });
    }
  });

  it("reads the catalog it was handed, never one of its own", async () => {
    const handed = catalogOf();
    const walked = vi.spyOn(handed, "inHelpOrder");

    const graph = await graphOf(root, { verbose: false }, undefined, handed);
    graph.runUserScopeDoctor;

    expect(walked).toHaveBeenCalled();
  });

  describe("marketplace add --overwrite", () => {
    const source = {
      kind: "local" as const,
      path: join(process.cwd(), "tests/fixtures/framework/marketplace-sample"),
    };

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function registerThenOverwrite(scope: Scope) {
      vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "user-config"));
      const { addMarketplace } = await graphOf(root, { verbose: false }, undefined, tools);
      const command = { source, name: "awesome", scope, projectRoot: root, autoTrust: true };
      await addMarketplace.execute(command);
      return addMarketplace.execute({ ...command, overwrite: true });
    }

    it("removes a project entry through the project remover", async () => {
      await expect(registerThenOverwrite("project")).resolves.toMatchObject({
        marketplace: { name: "awesome", scope: "project" },
      });
    });

    it("removes a user entry through the user remover, which proves ownership first", async () => {
      await expect(registerThenOverwrite("user")).rejects.toThrow(
        "Cannot prove AIDD ownership of user-scope marketplace 'awesome'"
      );
    });
  });

  describe("the commands it wires", () => {
    // A machine of its own: no home, no user config, no token and no host binary of the real
    // one. `HOME` alone only sandboxes POSIX: `os.homedir()` reads `USERPROFILE` on Windows,
    // and the config-dir rule reads `APPDATA` ahead of it.
    beforeEach(() => {
      const home = join(root, "home");
      vi.stubEnv("HOME", home);
      vi.stubEnv("USERPROFILE", home);
      vi.stubEnv("APPDATA", join(home, "AppData", "Roaming"));
      vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "user-config"));
      vi.stubEnv("PATH", join(root, "no-binaries"));
      vi.stubEnv("AIDD_TOKEN", undefined);
      vi.stubEnv("GH_TOKEN", undefined);
      vi.stubEnv("GITHUB_TOKEN", undefined);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    const aPlugin = (scope: Scope, extra: { mcpEntries?: Record<string, string> } = {}) =>
      InstalledPlugin.fromJSON({
        name: "aidd-dev",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        version: "1.0.0",
        strict: true,
        files: {},
        scope,
        ...extra,
      });

    it("checks every category of an installed project and reports no category it could not check", async () => {
      const { manifestRepo, doctorAllUseCase } = await graphOf(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await manifestRepo.save(manifest);

      const result = await doctorAllUseCase.execute(root);

      expect(result.errors).toEqual([]);
      expect(result.ai?.toolHealth).toEqual([
        { toolId: TOOL.claude, fileCount: 0, mergeFileCount: 0 },
      ]);
    });

    it("counts the token given on the command line as authenticated", async () => {
      const { manifestRepo, doctorUseCase } = await graphOf(
        root,
        { verbose: false, token: "ghp_given" },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await manifestRepo.save(manifest);

      const report = await doctorUseCase.execute({ projectRoot: root });

      expect(report.issues.map((issue) => issue.message)).not.toContain("Not authenticated");
    });

    it("purges the machine's built cache and checks each user plugin's files before deleting them", async () => {
      const builtCache = join(root, "user-config", "cache", "built");
      await mkdir(join(builtCache, "1.0.0"), { recursive: true });
      await writeFile(join(builtCache, "1.0.0", "marker"), "");
      const { userManifestRepo, cleanUserScopeUseCase } = await graphOf(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(TOOL.cursor, aPlugin("user"));
      await userManifestRepo.save(manifest);

      await cleanUserScopeUseCase.execute({ projectRoot: root, force: true });

      expect(existsSync(builtCache)).toBe(false);
    });

    it("refuses a user clean whose host binary cannot be found, naming why", async () => {
      const { userManifestRepo, cleanUserScopeUseCase } = await graphOf(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.claude, {
        binary: "claude",
        marketplaces: [],
        pluginRefs: [],
      });
      await userManifestRepo.save(manifest);

      await expect(
        cleanUserScopeUseCase.execute({ projectRoot: root, force: true })
      ).rejects.toThrow("User clean refused; canonical claims retained.");
    });

    it("purges the framework's own registered source on a user clean and keeps another marketplace's", async () => {
      const sources = join(root, "user-config", "cache", "marketplaces");
      await mkdir(join(sources, FRAMEWORK_MARKETPLACE_NAME), { recursive: true });
      await mkdir(join(sources, "awesome"), { recursive: true });
      await writeFile(join(sources, "awesome", "source"), "another marketplace's clone");
      const { cleanUserScopeUseCase } = await graphOf(root, { verbose: false }, undefined, tools);

      await cleanUserScopeUseCase.execute({ projectRoot: root, force: true });

      expect(existsSync(join(sources, FRAMEWORK_MARKETPLACE_NAME))).toBe(false);
      expect(existsSync(join(sources, "awesome"))).toBe(true);
    });

    it("names the framework's shared source when a user clean asks before removing it", async () => {
      const asked = vi.spyOn(SilentPrompterAdapter.prototype, "confirm").mockResolvedValue(false);
      const { cleanUserScopeUseCase } = await graphOf(root, { verbose: false }, undefined, tools);

      await cleanUserScopeUseCase.execute({
        projectRoot: root,
        force: false,
        interactive: true,
      });

      expect(asked).toHaveBeenCalledWith(
        expect.stringContaining(`Remove the shared '${FRAMEWORK_MARKETPLACE_NAME}' source`)
      );
    });

    it("tells a project clean which other projects still reference the framework's shared source, and drops only its own claim", async () => {
      const { registerFrameworkMarketplace, manifestRepo, userSourceReferences, cleanUseCase } =
        await graphOf(root, { verbose: false }, undefined, tools);
      await registerFrameworkMarketplace.execute({
        projectRoot: root,
        pluginSource: {
          kind: "local",
          path: join(process.cwd(), "tests/fixtures/framework/marketplace-sample"),
        },
      });
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await manifestRepo.save(manifest);
      const other = join(root, "other-project");
      await mkdir(other, { recursive: true });
      await userSourceReferences.addReference("1.0.0", await realpath(root));
      await userSourceReferences.addReference("1.0.0", await realpath(other));

      const result = await cleanUseCase.execute({ projectRoot: root, force: true });

      expect(result.preview.sharedSourceOtherProjects).toEqual([await realpath(other)]);
      expect(await userSourceReferences.listAllReferencingProjects()).toEqual([
        await realpath(other),
      ]);
    });

    it("purges this project's pre-migration copy once sync finds the framework at user scope", async () => {
      const { registerFrameworkMarketplace, manifestRepo, syncSettingsUseCase } = await graphOf(
        root,
        { verbose: false },
        undefined,
        tools
      );
      await registerFrameworkMarketplace.execute({
        projectRoot: root,
        pluginSource: {
          kind: "local",
          path: join(process.cwd(), "tests/fixtures/framework/marketplace-sample"),
        },
      });
      await manifestRepo.save(Manifest.create());
      const preMigration = join(root, BUILT_CACHE_SUBDIR, FRAMEWORK_MARKETPLACE_NAME);
      await mkdir(preMigration, { recursive: true });

      await syncSettingsUseCase.execute({
        projectRoot: root,
        recreateFrameworkIfMissing: true,
      });

      expect(existsSync(preMigration)).toBe(false);
    });

    it("moves a project-scope framework entry to the machine when sync recreates the framework", async () => {
      const { registerFrameworkMarketplace, manifestRepo, syncSettingsUseCase } = await graphOf(
        root,
        { verbose: false },
        undefined,
        tools
      );
      await registerFrameworkMarketplace.execute({
        projectRoot: root,
        pluginSource: {
          kind: "local",
          path: join(process.cwd(), "tests/fixtures/framework/marketplace-sample"),
        },
      });
      const userEntries = join(root, "user-config", "marketplaces.json");
      const projectEntries = join(root, ".aidd", "marketplaces.json");
      await mkdir(join(root, ".aidd"), { recursive: true });
      await writeFile(projectEntries, await readFile(userEntries, "utf8"));
      await rm(userEntries);
      await manifestRepo.save(Manifest.create());

      await syncSettingsUseCase.execute({
        projectRoot: root,
        recreateFrameworkIfMissing: true,
      });

      expect(await readFile(projectEntries, "utf8")).not.toContain(FRAMEWORK_MARKETPLACE_NAME);
      expect(await readFile(userEntries, "utf8")).toContain(FRAMEWORK_MARKETPLACE_NAME);
    });

    function hostedFramework() {
      // A host records the real location of a source it was given, never a symlinked temp path:
      // the native resolution, which also expands a Windows short name the way `fs.realpath` does.
      class RealpathHostActions extends FakeHostActions {
        override addMarketplace(source: string, scope?: unknown): void {
          super.addMarketplace(realpathSync.native(source), scope);
        }
      }
      const activator = new RealpathHostActions({ available: true });
      const base = wireBase({ projectRoot: root, verbose: false, tools });
      const withHost = {
        ...base,
        nativePluginActivators: new Map([["claude", activator]]),
        hostPluginRegistries: new Map([
          [TOOL.claude, new FakeHostPluginRegistry({ location: "fake host", refs: new Map() })],
        ]),
        nativeSources: new Map([
          [
            TOOL.claude,
            new FakeHostMarketplaceSources(
              activator,
              "registry",
              () => FRAMEWORK_MARKETPLACE_NAME,
              new Map()
            ),
          ],
        ]),
      };
      const { syncSettingsUseCase } = wireMarketplace(withHost, wireInstallation(withHost));
      return { activator, base, syncSettingsUseCase };
    }

    it("registers the framework marketplace with the host and enables its plugins through the host's own registries", async () => {
      const { activator, base, syncSettingsUseCase } = hostedFramework();
      await base.registerFrameworkMarketplace.execute({
        projectRoot: root,
        pluginSource: {
          kind: "local",
          path: join(process.cwd(), "tests/fixtures/framework"),
        },
      });
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await base.manifestRepo.save(manifest);

      await syncSettingsUseCase.execute({
        projectRoot: root,
        enablePlugins: ["aidd-test"],
      });

      expect(activator.addedMarketplaces).toHaveLength(1);
      expect(activator.enabledPlugins).toEqual([`aidd-test@${FRAMEWORK_MARKETPLACE_NAME}`]);
    });

    it("leaves the recorded manifests untouched when a second sync finds the host as recorded", async () => {
      const { base, syncSettingsUseCase } = hostedFramework();
      await base.registerFrameworkMarketplace.execute({
        projectRoot: root,
        pluginSource: {
          kind: "local",
          path: join(process.cwd(), "tests/fixtures/framework"),
        },
      });
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await base.manifestRepo.save(manifest);
      await syncSettingsUseCase.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });
      const projectSaves = vi.spyOn(base.manifestRepo, "save");
      const machineSaves = vi.spyOn(base.userManifestRepo, "save");

      await syncSettingsUseCase.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });

      expect(projectSaves).not.toHaveBeenCalled();
      expect(machineSaves).not.toHaveBeenCalled();
    });

    it("replaces a recorded source that no longer matches what the host holds", async () => {
      const { base, syncSettingsUseCase } = hostedFramework();
      await base.registerFrameworkMarketplace.execute({
        projectRoot: root,
        pluginSource: {
          kind: "local",
          path: join(process.cwd(), "tests/fixtures/framework"),
        },
      });
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await base.manifestRepo.save(manifest);
      await syncSettingsUseCase.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });
      const recorded = hostRecord(
        (await base.manifestRepo.load())?.getNativeRegistrations(TOOL.claude)
      );
      if (recorded === undefined) throw new Error("the first sync recorded nothing");
      const staled = await base.manifestRepo.load();
      if (staled === null) throw new Error("the first sync saved no manifest");
      staled.setNativeRegistrations(TOOL.claude, {
        ...recorded,
        marketplaces: recorded.marketplaces.map((entry) => ({
          ...entry,
          provenance: { kind: "registry", source: "elsewhere" },
        })),
      });
      await base.manifestRepo.save(staled);

      await syncSettingsUseCase.execute({ projectRoot: root, enablePlugins: ["aidd-test"] });

      expect(
        (await base.manifestRepo.load())?.getNativeRegistrations(TOOL.claude)?.marketplaces
      ).toEqual(recorded.marketplaces);
    });

    it("refuses a project clean whose plugin's MCP entries cannot be read back", async () => {
      const { manifestRepo, cleanUseCase } = await graphOf(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "1.0.0", []);
      manifest.addPlugin(TOOL.opencode, aPlugin("project", { mcpEntries: { server: "digest" } }));
      await manifestRepo.save(manifest);
      await mkdir(join(root, "opencode.json"));

      await expect(cleanUseCase.execute({ projectRoot: root, force: true })).rejects.toMatchObject({
        code: "EISDIR",
      });
      expect(existsSync(join(root, ".aidd", "manifest.json"))).toBe(true);
    });
  });

  it("builds a flat distribution through the graph's own files and assets", async () => {
    const fixture = join(process.cwd(), "tests/fixtures/framework");
    const { frameworkBuild } = await graphOf(root, { verbose: false }, undefined, tools);

    await frameworkBuild({ target: "copilot", mode: "flat", outDir: root, force: false })?.execute({
      sourceDir: fixture,
      outDir: root,
      target: TOOL.copilot,
    });

    expect(
      await readFile(join(root, ".github", "agents", "aidd-test-code-reviewer.agent.md"), "utf8")
    ).toContain("aidd-test-code-reviewer");
  });

  it("hands the IDE settings propagation the bundled assets, so a settings file kept in an asset is written", async () => {
    const base = wireBase({ projectRoot: root, verbose: false, tools: registeredTools() });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.copilot, "1.0.0", []);
    await base.manifestRepo.save(manifest);

    await wireInstallation(base).propagateAiSettingsToIde.execute({
      ideId: TOOL.vscode,
      projectRoot: root,
    });

    expect(
      JSON.parse(await readFile(join(root, ".vscode", "settings.json"), "utf8"))
    ).toHaveProperty("github.copilot.enable");
  });

  it("sends the menu to setup when no manifest exists", async () => {
    const ran: string[][] = [];
    const runner = {
      run: async (argv: string[]) => {
        ran.push(argv);
        return 1;
      },
    };

    const menuLoop = createContainer({
      projectRoot: root,
      verbose: false,
      tools: catalogOf(),
    }).menu({ runner, pause: { untilEnter: async () => {} } });

    expect(await menuLoop.execute()).toBe(1);
    expect(ran).toEqual([["setup"]]);
  });

  it("offers the menu, not setup, once the manifest at the project root lists a tool", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await new ManifestRepositoryAdapter(root, (raw) => catalogOf().toolId(raw)).save(manifest);
    const ran: string[][] = [];
    const runner = {
      run: async (argv: string[]) => {
        ran.push(argv);
        throw new Error("stop");
      },
    };

    const menuLoop = createContainer({
      projectRoot: root,
      verbose: false,
      tools: catalogOf(),
    }).menu({ runner, pause: { untilEnter: async () => {} } });

    await expect(menuLoop.execute()).rejects.toThrow("stop");
    expect(ran[0]).not.toEqual(["setup"]);
  });
});
