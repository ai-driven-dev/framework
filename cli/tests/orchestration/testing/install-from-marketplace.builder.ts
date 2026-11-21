/** Seeds an InstallFromMarketplace over in-memory deps and local marketplace catalogues. */
import { join } from "node:path";
import { FetchMarketplaceSource } from "../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ResolvePluginSource } from "../../../src/contexts/distribution/application/plugin-source/resolve-plugin-source.js";
import { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { InstallFromMarketplace } from "../../../src/orchestration/plugin/install-from-marketplace.js";
import type { Logger } from "../../../src/shared/ports/logger.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import type { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../shared/testing/installation-deps.builder.js";
import { cloneRequiringRawCatalog } from "../../shared/testing/raw-catalog.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { seedFromDirectory } from "../../shared/testing/seed-from-directory.builder.js";

export const PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);
export const EXTRA_PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/extra-plugin"
);
export const PROJECT_ROOT = "/test-project";
export const MKT1_DIR = "/mkt1";
export const MKT2_DIR = "/mkt2";

export function seedMarketplaceFile(
  fs: InMemoryFileAdapter,
  dir: string,
  plugins: Array<Record<string, unknown>>
): void {
  fs.writeFile(join(dir, ".claude-plugin/marketplace.json"), JSON.stringify({ plugins }));
}

export type InstallationDeps = Awaited<ReturnType<typeof buildInstallationDeps>>;

/** How a test builds the plugin installation the use case delegates to, over the deps and registry it is given. */
export type AddPluginFor = (
  deps: InstallationDeps,
  registry: InMemoryMarketplaceRegistry
) => ConstructorParameters<typeof InstallFromMarketplace>[0]["addPlugin"];

export async function buildUseCase(
  addPluginFor: AddPluginFor,
  options: { logger?: Logger | null; prompter?: Prompter } = {}
) {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  const catalogRepo = new PluginCatalogRepositoryAdapter(deps.fs);
  const fetchMarketplaceSource = new FetchMarketplaceSource({
    pluginFetcher: deps.pluginFetcher,
    rawCatalog: cloneRequiringRawCatalog(),
  });
  const logger = options.logger === null ? undefined : (options.logger ?? deps.logger);
  const useCase = new InstallFromMarketplace({
    resolvePluginSource: new ResolvePluginSource(
      registry,
      new ResolveMarketplace(fetchMarketplaceSource, catalogRepo)
    ),
    addPlugin: addPluginFor(deps, registry),
    prompter: options.prompter ?? new KeepPrompter(),
    logger,
  });
  return { useCase, deps, registry };
}

export async function saveLocalMarketplace(
  registry: InMemoryMarketplaceRegistry,
  name: string,
  dir: string
): Promise<void> {
  await registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name,
      source: { kind: "local", path: dir },
      scope: "project",
      addedAt: "2026-04-29T10:00:00.000Z",
    })
  );
}

export function installedSamplePlugin(deps: InstallationDeps) {
  return deps.manifestRepo
    .getCurrent()
    ?.getPlugins(TOOL.claude)
    .find((p) => p.name === "sample-plugin");
}
