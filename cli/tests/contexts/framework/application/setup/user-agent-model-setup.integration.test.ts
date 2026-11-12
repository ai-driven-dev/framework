import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { ResolveMarketplace } from "../../../../../src/contexts/distribution/application/resolve-marketplace-use-case.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceSourceMode } from "../../../../../src/contexts/distribution/domain/marketplace-source-mode.js";
import { MarketplaceSyncSettingsUseCase } from "../../../../../src/contexts/framework/application/flows/marketplace-sync-settings-use-case.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { InstallGlobalPluginsUseCase } from "../../../../../src/contexts/framework/application/setup/install-global-plugins-use-case.js";
import { SetupMachineScopeUseCase } from "../../../../../src/contexts/framework/application/setup/setup-machine-scope-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { SetupFlow } from "../../../../../src/contexts/framework/domain/setup-flow.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { userBuiltMarketplaceDir } from "../../../../../src/kernel/paths.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FakeHostMarketplaceRegistryReader } from "../../../../helpers/ports/fake-host-marketplace-registry-reader.js";
import { FakeNativeMarketplaceSourceReader } from "../../../../helpers/ports/fake-native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const HOME = "/home/test";
const SOURCE = "/framework";
const BUILT = "/cache/aidd-framework/codex";
const PLUGIN = "aidd-orchestrator";
const ROLES = ["explorer", "executor", "validator", "reviewer"] as const;
const agentPath = (role: string): string => `agents/${PLUGIN}-${role}.toml`;
const userAgentPath = (role: string): string => join(HOME, ".codex", agentPath(role));
const builtAgentPath = (role: string): string =>
  `${BUILT}/plugins/${PLUGIN}/codex-agents/${role}.toml`;
const CLAUDE_AGENT = join(HOME, ".claude/agents/executor.md");
const MARKETPLACE = Marketplace.create({
  name: "aidd-framework",
  source: { kind: "local", path: SOURCE },
  scope: "user",
  addedAt: "2026-01-01T00:00:00.000Z",
});

function marketplacePreflight(
  toolId: "codex" | "claude",
  state: "current" | "symlink" | "absent" | "different" | "unreadable"
): MarketplaceSyncSettingsUseCase {
  const name = "aidd-framework";
  const expected = userBuiltMarketplaceDir("/user-cache", "2.0.0", name, toolId);
  const registered =
    state === "different"
      ? "/old/cache/aidd-framework"
      : state === "symlink"
        ? "/alias/current-aidd-framework"
        : expected;
  const fs = new InMemoryFileAdapter();
  if (state === "symlink") fs.setSymlink(registered, expected);
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", []);
  const activator = new FakeNativePluginActivator({ available: true });
  const nativeSources = new Map([
    [
      "codex" as const,
      {
        read: async () =>
          state === "unreadable"
            ? { location: "codex marketplace list", unreadable: "EACCES" }
            : {
                location: "codex marketplace list",
                entries:
                  state === "absent"
                    ? new Map()
                    : new Map([
                        [
                          name,
                          {
                            kind: "effective-list" as const,
                            root: registered,
                            sourceType: "local",
                            source: registered,
                          },
                        ],
                      ]),
              },
      },
    ],
  ]);
  const hostMarketplaceRegistries = new Map([
    [
      "claude" as const,
      new FakeHostMarketplaceRegistryReader(
        state === "unreadable"
          ? { location: "claude marketplace registry", unreadable: "EACCES" }
          : state === "absent"
            ? { location: "claude marketplace registry", absent: true }
            : { location: "claude marketplace registry", entries: new Map([[name, registered]]) }
      ),
    ],
  ]);
  return new MarketplaceSyncSettingsUseCase(
    fs,
    new InMemoryManifestRepository(manifest),
    new InMemoryMarketplaceRegistry(),
    new DeterministicHasher(),
    new CapturingLogger(),
    new Map([[toolId, activator]]),
    fakeEnsureBuiltMarketplace(),
    hostMarketplaceRegistries,
    () => "/user-cache",
    undefined,
    undefined,
    { get: () => "2.0.0" },
    new Map(),
    new InMemoryManifestRepository(manifest),
    nativeSources
  );
}

function agent(instructions: string, model?: string, effort?: string): string {
  return [
    `description = "Executor ${instructions}"`,
    `developer_instructions = "${instructions}"`,
    ...(model === undefined ? [] : [`model = "${model}"`]),
    ...(effort === undefined ? [] : [`model_reasoning_effort = "${effort}"`]),
    "",
  ].join("\n");
}

it("setup --global preserves owned Codex model settings on repeated Codex + Claude setup", async () => {
  const hasher = new DeterministicHasher();
  const generated = Object.fromEntries(ROLES.map((role) => [role, agent(`${role} rules`)]));
  const edited = Object.fromEntries(
    ROLES.map((role) => [role, agent(`${role} rules`, "gpt-6-luna", "high")])
  );
  const claudeAgent = "---\nname: executor\nmodel: haiku\neffort: high\n---\nClaude rules\n";
  const fs = new InMemoryFileAdapter({
    ...Object.fromEntries(ROLES.map((role) => [builtAgentPath(role), generated[role]])),
    ...Object.fromEntries(ROLES.map((role) => [userAgentPath(role), edited[role]])),
    [CLAUDE_AGENT]: claudeAgent,
  });
  const manifest = Manifest.create();
  manifest.addTool("codex", "1.0.0", []);
  manifest.addTool("claude", "1.0.0", []);
  manifest.addPlugin(
    "codex",
    InstalledPlugin.fromMetadata(
      PLUGIN,
      "1.0.0",
      { kind: "local", path: `${SOURCE}/plugins/${PLUGIN}` },
      false,
      "user",
      MARKETPLACE.name
    ).withFiles(new Map(ROLES.map((role) => [agentPath(role), hasher.hash(generated[role]).value])))
  );
  const repo = new InMemoryManifestRepository(manifest);
  const marketplaceRegistry = new InMemoryMarketplaceRegistry();
  await marketplaceRegistry.save("/workspace", MARKETPLACE);
  const distribution = new PluginDistribution({
    manifest: { name: PLUGIN, version: "2.0.0" },
    format: "claude",
    files: [],
    components: {
      commands: [],
      agents: ROLES.map((role) => ({ relativePath: `agents/${role}.md`, content: "source" })),
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
  const logger = new CapturingLogger();
  const updater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(new FixturePluginFetcher(), { read: async () => distribution }),
    hasher,
    {
      homedir: () => HOME,
      marketplaceRegistry,
      ensureBuilt: fakeEnsureBuiltMarketplace(() => BUILT),
    }
  );
  const resolveMarketplace: ResolveMarketplace = {
    execute: async () => ({
      marketplace: MARKETPLACE,
      catalog: {
        plugins: [
          {
            name: PLUGIN,
            source: { kind: "local", path: `./plugins/${PLUGIN}` },
            recommended: true,
            strict: false,
            version: "2.0.0",
          },
        ],
      },
      localPath: SOURCE,
    }),
  };
  const install = new InstallGlobalPluginsUseCase(
    marketplaceRegistry,
    resolveMarketplace,
    updater,
    logger
  );
  let preservePluginState: boolean | undefined;
  const setup = new SetupMachineScopeUseCase(
    repo,
    {
      resolveSourceIfNeeded: async () => null,
      registerIfPresent: async () => undefined,
    },
    {
      preflightUserMarketplaceSource: async () => undefined,
      execute: async (options) => {
        preservePluginState = options.preserveUserPluginState;
        return { activated: [], binaryMissing: [], warnings: [], errors: [] };
      },
    },
    { get: () => "2.0.0" },
    install
  );
  const flow = new SetupFlow({
    projectRoot: "/workspace",
    aiTools: ["codex", "claude"],
    scope: "user",
    preservePluginState: true,
    pluginMode: "all",
    registerDefaultMarketplace: false,
  });

  await setup.execute(flow);
  expect(preservePluginState).toBe(true);
  const first = repo.getCurrent()?.getPlugins("codex")[0];
  for (const role of ROLES) {
    expect(first?.userFileOverrides[agentPath(role)]).toEqual({
      model: "gpt-6-luna",
      model_reasoning_effort: "high",
    });
    expect(first?.files.get(agentPath(role))).toBe(hasher.hash(edited[role]).value);
    expect(await fs.readFile(userAgentPath(role))).toBe(edited[role]);
  }
  expect(await fs.readFile(CLAUDE_AGENT)).toBe(claudeAgent);

  const persisted = repo.getCurrent();
  if (persisted === null) throw new Error("expected setup to save a user manifest");
  await repo.save(Manifest.fromJSON(persisted.toJSON()));
  await setup.execute(flow);
  const second = repo.getCurrent()?.getPlugins("codex")[0];
  for (const role of ROLES) {
    expect(second?.userFileOverrides[agentPath(role)]).toEqual(
      first?.userFileOverrides[agentPath(role)]
    );
    expect(second?.files.get(agentPath(role))).toBe(first?.files.get(agentPath(role)));
    expect(await fs.readFile(userAgentPath(role))).toBe(edited[role]);
  }
  expect(await fs.readFile(CLAUDE_AGENT)).toBe(claudeAgent);
});

it("reports partial setup after registry update when native registration conflicts", async () => {
  const userRepo = new InMemoryManifestRepository(Manifest.create());
  const marketplaces = new InMemoryMarketplaceRegistry();
  const current = Marketplace.create({
    name: "aidd-framework",
    source: { kind: "local", path: "/old-framework" },
    scope: "user",
    addedAt: "2026-01-01T00:00:00.000Z",
  });
  await marketplaces.save("/workspace", current);
  const replacement = Marketplace.create({
    name: "aidd-framework",
    source: { kind: "local", path: "/new-framework" },
    scope: "user",
    addedAt: "2026-01-02T00:00:00.000Z",
  });
  const setup = new SetupMachineScopeUseCase(
    userRepo,
    {
      resolveSourceIfNeeded: async () => MarketplaceSourceMode.local("/new-framework"),
      registerIfPresent: async () => marketplaces.save("/workspace", replacement),
    },
    {
      preflightUserMarketplaceSource: async () => undefined,
      execute: async () => ({
        activated: [],
        binaryMissing: [],
        warnings: [],
        errors: [{ scope: "codex", message: "marketplace source conflict" }],
      }),
    },
    { get: () => "2.0.0" }
  );

  await expect(
    setup.execute(
      new SetupFlow({
        projectRoot: "/workspace",
        aiTools: ["codex"],
        scope: "user",
        pluginMode: "none",
        preservePluginState: true,
        registerDefaultMarketplace: true,
      })
    )
  ).rejects.toThrow(/Some file or host changes may already be applied/);
  expect(await marketplaces.list("/workspace")).toEqual([replacement]);
});

it.each(["codex", "claude"] as const)(
  "preflights %s source before changing the shared marketplace registry",
  async (toolId) => {
    const oldSource = `/cache/built/5.6.0/aidd-framework/${toolId}`;
    const expectedSource = userBuiltMarketplaceDir(
      "/user-cache",
      "2.0.0",
      "aidd-framework",
      toolId
    );
    const marketplaceRegistry = new InMemoryMarketplaceRegistry();
    const oldMarketplace = Marketplace.create({
      name: "aidd-framework",
      source: { kind: "local", path: "/old-framework" },
      scope: "user",
      addedAt: "2026-01-01T00:00:00.000Z",
    });
    await marketplaceRegistry.save("/workspace", oldMarketplace);
    const manifest = Manifest.create();
    manifest.addTool(toolId, "1.0.0", []);
    const activator = new FakeNativePluginActivator({ available: true });
    const sourceReader = new FakeNativeMarketplaceSourceReader(
      activator,
      "effective-list",
      (path) => (path === expectedSource ? "aidd-framework" : undefined),
      new Map([
        [
          "aidd-framework",
          {
            kind: "effective-list",
            root: oldSource,
            sourceType: "local",
            source: oldSource,
          },
        ],
      ])
    );
    const sync = new MarketplaceSyncSettingsUseCase(
      new InMemoryFileAdapter(),
      new InMemoryManifestRepository(manifest),
      marketplaceRegistry,
      new DeterministicHasher(),
      new CapturingLogger(),
      new Map([[toolId, activator]]),
      fakeEnsureBuiltMarketplace(),
      toolId === "claude"
        ? new Map([
            [
              "claude",
              new FakeHostMarketplaceRegistryReader({
                location: "/host/claude/known_marketplaces.json",
                entries: new Map([["aidd-framework", oldSource]]),
              }),
            ],
          ])
        : new Map(),
      () => "/user-cache",
      undefined,
      undefined,
      { get: () => "2.0.0" },
      new Map(),
      new InMemoryManifestRepository(manifest),
      toolId === "codex" ? new Map([["codex", sourceReader]]) : new Map()
    );
    const replacement = Marketplace.create({
      name: "aidd-framework",
      source: { kind: "local", path: "/new-framework" },
      scope: "user",
      addedAt: "2026-01-02T00:00:00.000Z",
    });
    let registered = false;
    const setup = new SetupMachineScopeUseCase(
      new InMemoryManifestRepository(manifest),
      {
        resolveSourceIfNeeded: async () => MarketplaceSourceMode.local("/new-framework"),
        registerIfPresent: async () => {
          registered = true;
          await marketplaceRegistry.save("/workspace", replacement);
        },
      },
      sync,
      { get: () => "2.0.0" }
    );

    await expect(
      setup.execute(
        new SetupFlow({
          projectRoot: "/workspace",
          aiTools: [toolId],
          scope: "user",
          pluginMode: "none",
          preservePluginState: true,
          registerDefaultMarketplace: true,
        })
      )
    ).rejects.toThrow(/is registered from/);
    expect(registered).toBe(false);
    expect(await marketplaceRegistry.list("/workspace")).toEqual([oldMarketplace]);
  }
);

it.each(["codex", "claude"] as const)(
  "allows %s preflight when its marketplace already uses the current source",
  async (toolId) => {
    await expect(
      marketplacePreflight(toolId, "current").preflightUserMarketplaceSource("/workspace", [toolId])
    ).resolves.toBeUndefined();
  }
);

it.each(["codex", "claude"] as const)(
  "resolves %s marketplace symlinks during preflight",
  async (toolId) => {
    await expect(
      marketplacePreflight(toolId, "symlink").preflightUserMarketplaceSource("/workspace", [toolId])
    ).resolves.toBeUndefined();
  }
);

it.each(["codex", "claude"] as const)(
  "allows %s preflight when no marketplace is registered",
  async (toolId) => {
    await expect(
      marketplacePreflight(toolId, "absent").preflightUserMarketplaceSource("/workspace", [toolId])
    ).resolves.toBeUndefined();
  }
);

it.each(["codex", "claude"] as const)(
  "refuses %s preflight when the marketplace state is unreadable",
  async (toolId) => {
    await expect(
      marketplacePreflight(toolId, "unreadable").preflightUserMarketplaceSource("/workspace", [
        toolId,
      ])
    ).rejects.toThrow(/unreadable/);
  }
);
