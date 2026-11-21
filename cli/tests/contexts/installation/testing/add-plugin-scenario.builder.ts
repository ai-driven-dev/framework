import { join } from "node:path";
import type { AddPlugin } from "../../../../src/contexts/installation/application/plugin/add-plugin.js";
import { PluginDistributionLoader } from "../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";
import type { buildInstallationDeps } from "../../../shared/testing/installation-deps.builder.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "./build-add-plugin.builder.js";
import { fakeBuildSources } from "./fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "./fake-marketplace-registry.fake.js";

export const PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);
export const EXTRA_PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/extra-plugin"
);
export const PROJECT_ROOT = "/test-project";
export const GREET_PATH = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
export const GITHUB_SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};

export type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

export class RefusingMarketplaceRegistry extends FakeMarketplaceRegistry {
  override async list(): ReturnType<FakeMarketplaceRegistry["list"]> {
    throw new Error("the registry was consulted");
  }
}

export function buildAddUseCase(
  deps: Deps,
  registry: FakeMarketplaceRegistry = new FakeMarketplaceRegistry(),
  logger: Logger = deps.logger
): AddPlugin {
  return buildAddPlugin(
    { fs: deps.fs, logger: logger },
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
  );
}

export async function makeUseCase(deps: Deps) {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  return buildAddUseCase(deps);
}

export async function saveMarketplace(
  registry: FakeMarketplaceRegistry,
  name: string,
  source: { kind: "github"; repo: string } | { kind: "local"; path: string }
): Promise<void> {
  registry.seed(PROJECT_ROOT, {
    name,
    source,
    scope: "project",
  });
}

export function localAdd(toolId: AiToolId, path = PLUGIN_FIXTURE, replace?: boolean) {
  return {
    source: { kind: "local" as const, path },
    toolIds: [toolId],
    projectRoot: PROJECT_ROOT,
    interactive: false,
    githubMarketplace: false,
    replace,
    tools: registeredTools(),
  };
}

export function pluginNames(deps: Deps, toolId: AiToolId): string[] {
  return (deps.manifestRepo.getCurrent()?.getPlugins(toolId) ?? []).map((p) => p.name).sort();
}
