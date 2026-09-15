// `claude`, `codex` and `copilot` only load a plugin once their own CLI has registered it, so
// removal must drive `uninstallPlugin` with the same `<plugin>@<marketplace>` ref install used.
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/framework/application/framework/translator/mode-a-marketplace-translator.js";
import { PluginRemoveUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_NAME = "aidd-framework";
const PLUGIN_NAME = "aidd-telemetry";
const REF = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

function buildDist(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: PLUGIN_NAME, version: "1.0.0" },
    format: "claude",
    files: [{ relativePath: "commands/hello.md", content: "# Hello" }],
    components: {
      commands: [{ relativePath: "commands/hello.md", content: "# Hello" }],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

async function installViaModeA(manifest: Manifest): Promise<void> {
  await new ModeAMarketplaceTranslator().addPlugin(
    buildDist(),
    "claude",
    { kind: "local", path: "/plugin-source" },
    PROJECT_ROOT,
    manifest,
    MARKETPLACE_NAME
  );
  manifest.setNativeRegistrations("claude", {
    binary: "claude",
    marketplaces: [
      {
        alias: MARKETPLACE_NAME,
        hostName: MARKETPLACE_NAME,
        provenance: { kind: "registry", source: "/plugin-source" },
      },
    ],
    pluginRefs: [REF],
  });
}

function verifiedSourceReader() {
  return {
    read: async () => ({
      location: "/host/catalogue",
      entries: new Map([
        [MARKETPLACE_NAME, { kind: "registry" as const, source: "/plugin-source" }],
        ["upstream", { kind: "registry" as const, source: "/plugin-source" }],
      ]),
    }),
  };
}

function buildRemoveUseCase(
  activator: FakeNativePluginActivator,
  logger: CapturingLogger,
  hostScope: "project" | "user" = "project"
): { removeUseCase: PluginRemoveUseCase; manifestRepo: InMemoryManifestRepository } {
  const fs = new InMemoryFileAdapter();
  const manifestRepo = new InMemoryManifestRepository();
  const removeUseCase = new PluginRemoveUseCase(
    fs,
    manifestRepo,
    logger,
    new Map([["claude", activator]]),
    new Map([
      [
        "claude",
        new FakeHostPluginRegistryReader({
          location: "/host/plugin-registry",
          refs: new Map([
            [REF, { enabled: true, scope: hostScope }],
            [`${PLUGIN_NAME}@upstream`, { enabled: true, scope: "project" }],
          ]),
        }),
      ],
    ]),
    undefined,
    undefined,
    undefined,
    new Map([["claude", verifiedSourceReader()]])
  );
  return { removeUseCase, manifestRepo };
}

describe("PluginRemoveUseCase undoes native activation", () => {
  it("removes only the local projection when Claude CLI is unavailable and no native catalogue source was recorded", async () => {
    const fs = new InMemoryFileAdapter();
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      "claude",
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      MARKETPLACE_NAME
    );
    const repo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
    const activator = new FakeNativePluginActivator({ available: false });
    const logger = new CapturingLogger();
    const removeUseCase = new PluginRemoveUseCase(
      fs,
      repo,
      logger,
      new Map([["claude", activator]])
    );

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(repo.getCurrent()?.getPlugins("claude")).toEqual([]);
    expect(logger.warnMessages.join(" ")).toMatch(/CLI not found|host ref may remain/);
  });

  it("does not uninstall or purge a same-name foreign host ref even without a machine-global claim", async () => {
    const fs = new InMemoryFileAdapter();
    const cacheEntry = join(
      homedir(),
      ".claude/plugins/cache",
      MARKETPLACE_NAME,
      PLUGIN_NAME,
      "1.0.0/plugin.json"
    );
    fs.setFile(cacheEntry, "cache witness");
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE_NAME,
          hostName: MARKETPLACE_NAME,
          provenance: { kind: "registry", source: "/aidd/old-source" },
        },
      ],
      pluginRefs: [REF],
    });
    const repo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
    const activator = new FakeNativePluginActivator({ available: true });
    const removeUseCase = new PluginRemoveUseCase(
      fs,
      repo,
      new CapturingLogger(),
      new Map([["claude", activator]]),
      new Map(),
      undefined,
      undefined,
      undefined,
      new Map([
        [
          "claude",
          {
            read: async () => ({
              location: "/host/catalogue",
              entries: new Map([
                [MARKETPLACE_NAME, { kind: "registry" as const, source: "/foreign/source" }],
              ]),
            }),
          },
        ],
      ])
    );
    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/source differs/);
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(fs.getFile(cacheEntry)).toBe("cache witness");
    expect(repo.getCurrent()?.getPlugins("claude")).toHaveLength(1);
    expect(repo.getCurrent()?.getNativeRegistrations("claude")?.pluginRefs).toEqual([REF]);
  });

  it("refuses an old AIDD catalogue claim when the current host source is foreign under the same name and ref", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const fs = new InMemoryFileAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const machine = Manifest.create();
    machine.addTool("claude", "test", []);
    machine.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [PROJECT_ROOT] }],
    });
    const userRepo = new InMemoryManifestRepository(machine);
    const removeUseCase = new PluginRemoveUseCase(
      fs,
      manifestRepo,
      logger,
      new Map([["claude", activator]]),
      new Map(),
      undefined,
      undefined,
      userRepo,
      new Map([
        [
          "claude",
          {
            read: async () => ({
              location: "/host/catalogue",
              entries: new Map([
                [MARKETPLACE_NAME, { kind: "registry" as const, source: "/foreign/source" }],
              ]),
            }),
          },
        ],
      ])
    );
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE_NAME,
          hostName: MARKETPLACE_NAME,
          provenance: { kind: "registry", source: "/aidd/old-source" },
        },
      ],
      pluginRefs: [REF],
    });
    await manifestRepo.save(manifest);
    const savesBefore = manifestRepo.saveCount;
    const machineSavesBefore = userRepo.saveCount;

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/source differs|reconcile manually/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.saveCount).toBe(savesBefore);
    expect(userRepo.saveCount).toBe(machineSavesBefore);
    expect(
      manifestRepo
        .getCurrent()
        ?.getPlugins("claude")
        .map((plugin) => plugin.name)
    ).toEqual([PLUGIN_NAME]);
    expect(manifestRepo.getCurrent()?.getNativeRegistrations("claude")?.pluginRefs).toEqual([REF]);
    expect(userRepo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims).toEqual([
      { ref: REF, dependents: [PROJECT_ROOT] },
    ]);
  });

  it("uninstalls via the host CLI using the same <plugin>@<marketplace> ref install used", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([REF]);
    expect(logger.warnMessages).toEqual([]);
  });

  it("warns naming the host and leaves the removal complete when the CLI is not on PATH", async () => {
    const activator = new FakeNativePluginActivator({ available: false });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(
      logger.warnMessages.some((message) => message.includes("claude") && message.includes(REF))
    ).toBe(true);
    const loaded = await manifestRepo.load();
    expect(loaded?.getPlugins("claude").some((p) => p.name === PLUGIN_NAME)).toBe(false);
    expect(loaded?.getNativeRegistrations("claude")?.pluginRefs).toEqual([REF]);
  });

  it("warns naming the host and message when the host CLI reports the plugin already absent", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      failOnUninstall: [REF],
    });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    await manifestRepo.save(manifest);

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.not.toThrow();

    expect(
      logger.warnMessages.some((message) => message.includes("claude") && message.includes(REF))
    ).toBe(true);
  });

  it("never calls the host CLI for a plugin installed without a recorded marketplace", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      "claude",
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      undefined
    );
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(logger.warnMessages).toEqual([]);
  });

  // A real `claude` binary registers at its own implicit `"user"` default whatever scope the
  // manifest records for the plugin's files, and refuses an uninstall aimed at another scope.
  it("uses the host registry's exact user scope when the project manifest differs", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      installedAtScope: new Map([[REF, "user"]]),
    });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger, "user");
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([REF]);
    expect(activator.uninstalledPluginScopes).toEqual(["user"]);
    expect(logger.warnMessages).toEqual([]);
  });

  // The host call must address the host by `hostName`, read from this tool's own
  // `nativeRegistrations` — never by `plugin.marketplace`, a local alias a host never learns.
  it("uses the host's own name for the marketplace, read from this tool's own native registrations", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      "claude",
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      "local"
    );
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: "local",
          hostName: "upstream",
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs: [`${PLUGIN_NAME}@upstream`],
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([`${PLUGIN_NAME}@upstream`]);
  });

  it("resolves the host's own registry by the hostName-keyed ref, not the alias", async () => {
    const hostRef = `${PLUGIN_NAME}@upstream`;
    const activator = new FakeNativePluginActivator({
      available: true,
      installedAtScope: new Map([[hostRef, "user"]]),
    });
    const logger = new CapturingLogger();
    const fs = new InMemoryFileAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const removeUseCase = new PluginRemoveUseCase(
      fs,
      manifestRepo,
      logger,
      new Map([["claude", activator]]),
      new Map([
        [
          "claude",
          new FakeHostPluginRegistryReader({
            location: "/registry",
            refs: new Map([[hostRef, { enabled: true, scope: "user" }]]),
          }),
        ],
      ]),
      undefined,
      undefined,
      undefined,
      new Map([["claude", verifiedSourceReader()]])
    );
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await new ModeAMarketplaceTranslator().addPlugin(
      buildDist(),
      "claude",
      { kind: "local", path: "/plugin-source" },
      PROJECT_ROOT,
      manifest,
      "local"
    );
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: "local",
          hostName: "upstream",
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs: [`${PLUGIN_NAME}@upstream`],
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([hostRef]);
    expect(activator.uninstalledPluginScopes).toEqual(["user"]);
  });

  it("refuses a legacy alias with no recorded native source before changing the project", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [{ alias: "some-other-marketplace", hostName: "other" }],
      pluginRefs: [],
    });
    await manifestRepo.save(manifest);

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/no recorded native catalogue source/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(manifestRepo.getCurrent()?.getPlugins("claude")).toHaveLength(1);
  });

  it("reads an unproved native registration only for preflight, not for uninstall or cache", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [{ alias: "some-other-marketplace", hostName: "other" }],
      pluginRefs: [],
    });
    await manifestRepo.save(manifest);
    const stored = await manifestRepo.load();
    if (stored === null) throw new Error("unreachable — just saved");
    const spy = vi.spyOn(stored, "getNativeRegistrations");

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/no recorded native catalogue source/);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("uninstalls at the scope the host's own registry names directly, one attempt", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      installedAtScope: new Map([[REF, "user"]]),
    });
    const logger = new CapturingLogger();
    const fs = new InMemoryFileAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const removeUseCase = new PluginRemoveUseCase(
      fs,
      manifestRepo,
      logger,
      new Map([["claude", activator]]),
      new Map([
        [
          "claude",
          new FakeHostPluginRegistryReader({
            location: "/registry",
            refs: new Map([[REF, { enabled: true, scope: "user" }]]),
          }),
        ],
      ]),
      undefined,
      undefined,
      undefined,
      new Map([["claude", verifiedSourceReader()]])
    );
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toEqual([REF]);
    expect(activator.uninstalledPluginScopes).toEqual(["user"]);
  });

  it("logs nothing when this tool's own native registrations name the alias", async () => {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE_NAME,
          hostName: "upstream",
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs: [`${PLUGIN_NAME}@upstream`],
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(activator.uninstalledPlugins).toStrictEqual([`${PLUGIN_NAME}@upstream`]);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names the host, the ref and the host's answer when the host CLI refuses the uninstall", async () => {
    const activator = new FakeNativePluginActivator({
      available: true,
      failOnUninstall: [REF],
    });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });

    expect(logger.warnMessages).toContain(
      `claude plugin uninstall '${REF}' failed: plugin \`${REF}\` is not installed — an entry for it may remain in claude's own plugin registry.`
    );
  });

  it("propagates a failure that is not the host CLI refusing", async () => {
    const activator = new FakeNativePluginActivator({ available: true, crashOnUninstall: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    await manifestRepo.save(manifest);

    await expect(
      removeUseCase.execute({
        pluginName: PLUGIN_NAME,
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow("activator crashed uninstalling a plugin");
  });
});

describe("PluginRemoveUseCase undoes only the activation this project made", () => {
  async function removeWithRecordedRefs(pluginRefs: readonly string[]) {
    const activator = new FakeNativePluginActivator({ available: true });
    const logger = new CapturingLogger();
    const { removeUseCase, manifestRepo } = buildRemoveUseCase(activator, logger);
    const manifest = Manifest.create();
    manifest.addTool("claude", "test", []);
    await installViaModeA(manifest);
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: MARKETPLACE_NAME,
          hostName: MARKETPLACE_NAME,
          provenance: { kind: "registry", source: "/plugin-source" },
        },
      ],
      pluginRefs,
    });
    await manifestRepo.save(manifest);

    await removeUseCase.execute({
      pluginName: PLUGIN_NAME,
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });
    return { activator, logger, manifestRepo };
  }

  it("leaves enabled, and names, a ref the host already had before this project", async () => {
    const { activator, logger, manifestRepo } = await removeWithRecordedRefs([]);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(logger.warnMessages.join("\n")).toContain(REF);
    const loaded = await manifestRepo.load();
    expect(loaded?.getPlugins("claude").some((p) => p.name === PLUGIN_NAME)).toBe(false);
  });

  it("uninstalls a ref this project's own activation enabled", async () => {
    const { activator } = await removeWithRecordedRefs([REF]);

    expect(activator.uninstalledPlugins).toEqual([REF]);
  });
});
