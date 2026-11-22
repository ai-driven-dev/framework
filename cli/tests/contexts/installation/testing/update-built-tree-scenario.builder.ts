import { join } from "node:path";
import { builtMaterializationDepsOf } from "../../../../src/composition/installation.js";
import { RefreshHostPlugin } from "../../../../src/contexts/host-registration/application/refresh-host-plugin.use-case.js";
import { PluginDistributionLoader } from "../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { PluginMaterializer } from "../../../../src/contexts/installation/application/plugin/plugin-materializer.js";
import { UpdateUserPluginFiles } from "../../../../src/contexts/installation/application/plugin/update-user-plugin-files.use-case.js";
import type { BuiltMarketplaceEnsurer } from "../../../../src/contexts/installation/contract/built-marketplace.js";
import type { IsWithinUserScope } from "../../../../src/contexts/machine-claims/contract/user-scope-containment.js";
import { UpdateUserPlugin } from "../../../../src/orchestration/plugin/update-user-plugin.use-case.js";
import { fakeEnsureBuiltMarketplace } from "../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import type { buildInstallationDeps } from "../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "./build-add-plugin.builder.js";
import { fakeBuildSources, translateDistribution } from "./fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "./fake-marketplace-registry.fake.js";
import { userScopeFileGuard } from "./user-scope-file-guard.fake.js";

/** The machine-claims answer for a path it judges inside the user directory. */
export const insideUserScope: IsWithinUserScope = () => true;
/** The machine-claims answer for a path it judges outside the user directory. */
export const outsideUserScope: IsWithinUserScope = () => false;

export const PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);
export const PROJECT_ROOT = "/test-project";
const { cursor, copilot } = TOOL;
export const HOME = "/home/u";
/** Where cursor's PluginsCapability resolves user-scope plugin writes to. */
export const USER_PLUGINS_DIR = join(HOME, ".cursor/plugins/local");
export const BUILT_SKILL = "/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md";

export const GIT_SUBDIR_SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};
export const PLUGIN_METADATA = { name: "sample-plugin", version: "1.0.0", strict: false };

export type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

export async function makeRegistry(): Promise<FakeMarketplaceRegistry> {
  const registry = new FakeMarketplaceRegistry();
  registry.seed(PROJECT_ROOT, {
    name: "aidd-framework",
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
  });
  return registry;
}

export function makeUpdateUseCase(
  deps: Deps,
  registry: FakeMarketplaceRegistry,
  nativeHost: RefreshHostPlugin = new RefreshHostPlugin(new Map(), new Map()),
  ensureBuilt: BuiltMarketplaceEnsurer = fakeEnsureBuiltMarketplace()
): UpdateUserPlugin {
  return new UpdateUserPlugin(
    new UpdateUserPluginFiles(
      {
        repo: deps.userManifestRepo,
        materializer: new PluginMaterializer({
          fs: deps.fs,
          loader: new PluginDistributionLoader(deps.pluginFetcher, deps.pluginDistributionReader),
          guard: userScopeFileGuard,
          builtDeps: builtMaterializationDepsOf(deps.fs, {
            ensureBuilt,
            marketplaceRegistry: registry,
            platform: process.platform,
            homedir: () => HOME,
            translate: translateDistribution,
          }),
        }),
        logger: deps.logger,
        records: deps.registrationRecordRules,
      },
      registeredTools()
    ),
    nativeHost,
    insideUserScope
  );
}

/** Installs a cursor marketplace plugin, then lowers its recorded version so update re-materializes. */
export async function installStalePlugin(
  deps: Deps,
  registry: FakeMarketplaceRegistry
): Promise<void> {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
  deps.fs.setFile(BUILT_SKILL, "# Demo skill");
  await buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        deps.pluginDistributionReader
      ),
      marketplaceRegistry: registry,
      ...fakeBuildSources(),
    },
    registeredTools()
  ).execute({
    githubMarketplace: false,
    source: GIT_SUBDIR_SOURCE,
    toolIds: [cursor],
    projectRoot: PROJECT_ROOT,
    marketplace: "aidd-framework",
    interactive: false,
    pluginMetadata: PLUGIN_METADATA,
  });
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("manifest not found");
  const plugin = manifest.getPlugins(cursor).find((p) => p.name === "sample-plugin");
  if (plugin === undefined) throw new Error("plugin not found");
  manifest.updatePlugin(cursor, plugin.withVersion("0.0.1"));
  await deps.manifestRepo.save(manifest);
  const machine = deps.userManifestRepo.getCurrent();
  if (machine === null) throw new Error("user manifest not found");
  const owned = machine.getPlugins(cursor).find((p) => p.name === "sample-plugin");
  if (owned === undefined) throw new Error("machine plugin not found");
  // The fake built-tree install records this file but its test adapter does not deliver it.
  // Supply the recorded install bytes so the provenance guard has a real current file.
  deps.fs.setFile(join(USER_PLUGINS_DIR, "sample-plugin/skills/demo/SKILL.md"), "# Demo skill");
  machine.updatePlugin(cursor, owned.withVersion("0.0.1"));
  await deps.userManifestRepo.save(machine);
}

export function attachFutureSupportedNativeClaim(deps: Deps) {
  const machine = deps.userManifestRepo.getCurrent();
  if (machine === null) throw new Error("fixture missing machine manifest");
  machine.addTool(copilot, "future-supported", []);
  machine.setNativeRegistrations(copilot, {
    binary: "copilot",
    marketplaces: [
      {
        alias: "aidd-catalog",
        hostName: "aidd-catalog",
        provenance: { kind: "registry", source: "/aidd/catalog" },
      },
    ],
    pluginRefs: ["native-plugin@aidd-catalog"],
    pluginClaims: [{ ref: "native-plugin@aidd-catalog", dependents: [PROJECT_ROOT] }],
  });
  const activator = new FakeHostActions({ available: true });
  const nativeHost = new RefreshHostPlugin(
    new Map([[copilot, activator]]),
    new Map([
      [
        copilot,
        {
          read: async () => ({
            location: "/host/plugin-registry",
            refs: new Map([
              ["native-plugin@aidd-catalog", { enabled: true, scope: "user" as const }],
            ]),
          }),
        },
      ],
    ]),
    new Map([
      [
        copilot,
        {
          read: async () => ({
            location: "/verified/future/host-source-port",
            entries: new Map([
              ["aidd-catalog", { kind: "registry" as const, source: "/aidd/catalog" }],
            ]),
          }),
        },
      ],
    ])
  );
  return { machine, activator, nativeHost };
}
