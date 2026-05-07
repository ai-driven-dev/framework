import { resolve } from "node:path";
// Register all tools so use-cases that call getToolConfig / getIdeToolConfig don't throw
import "../../../src/domain/tools/ai/claude.js";
import "../../../src/domain/tools/ai/codex.js";
import "../../../src/domain/tools/ai/copilot.js";
import "../../../src/domain/tools/ai/cursor.js";
import "../../../src/domain/tools/ai/opencode.js";
import "../../../src/domain/tools/ide/vscode.js";
import { CLIOutput } from "../../../src/application/output.js";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { InstallIdeConfigUseCase } from "../../../src/application/use-cases/install/install-ide-config-use-case.js";
import { InstallRuntimeConfigUseCase } from "../../../src/application/use-cases/install/install-runtime-config-use-case.js";
import { InstallUseCase } from "../../../src/application/use-cases/install/install-use-case.js";
import { BundledAssetProviderAdapter } from "../../../src/infrastructure/assets/asset-loader.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import type { ToolId } from "../../../src/domain/tools/registry.js";
import { DeterministicHasher } from "./deterministic-hasher.js";
import { FakeCurrentVersion } from "./fake-current-version.js";
import { FakePlatform } from "./fake-platform.js";
import { FixturePluginFetcher } from "./fixture-plugin-fetcher.js";
import { InMemoryFileSystem } from "./in-memory-file-system.js";
import { InMemoryManifestRepository } from "./in-memory-manifest-repository.js";
import { OverwritePrompter } from "./scripted-prompter.js";
import { seedFromDirectory } from "./seed-from-directory.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");

/**
 * Builds in-memory deps for use-case unit tests.
 * The InMemoryFileSystem is pre-seeded with the framework fixture content (absolute paths).
 */
export async function buildUnitDeps(projectRoot: string) {
  const hasher = new DeterministicHasher();
  const fs = new InMemoryFileSystem({}, hasher);
  const manifestRepo = new InMemoryManifestRepository();
  const logger = new CLIOutput(false);
  const assetProvider = new BundledAssetProviderAdapter();
  const pluginFetcher = new FixturePluginFetcher();
  const pluginDistributionReader = new PluginDistributionReaderAdapter(fs);
  const pluginCatalogRepository = new PluginCatalogRepositoryAdapter(fs);
  const installRuntimeConfigUseCase = new InstallRuntimeConfigUseCase(
    fs,
    manifestRepo,
    hasher,
    logger,
    assetProvider
  );
  const installIdeConfigUseCase = new InstallIdeConfigUseCase(
    fs,
    manifestRepo,
    hasher,
    logger,
    assetProvider
  );

  const currentVersionProvider = new FakeCurrentVersion();

  // Seed the framework fixture content so the install use-case can read it
  await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });

  return {
    hasher,
    fs,
    manifestRepo,
    logger,
    assetProvider,
    pluginFetcher,
    pluginDistributionReader,
    pluginCatalogRepository,
    installRuntimeConfigUseCase,
    installIdeConfigUseCase,
    currentVersionProvider,
  };
}

export async function initProject(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  projectRoot: string
): Promise<void> {
  const initUseCase = new InitUseCase(deps.fs, deps.manifestRepo);
  await initUseCase.execute({ projectRoot });
}

export async function installTool(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  projectRoot: string,
  toolId: ToolId
) {
  const installUseCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    new FakePlatform("linux"),
    new OverwritePrompter(),
    deps.pluginFetcher,
    deps.pluginDistributionReader,
    deps.pluginCatalogRepository
  );
  const results = await installUseCase.execute({
    toolIds: [toolId],
    frameworkPath: FIXTURE_DIR,
    version: "test",
    docsDir: "aidd_docs",
    projectRoot,
    mcpFilter: ["playwright", "github"],
  });
  return results[0];
}

export async function initAndInstall(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  projectRoot: string,
  toolId: ToolId
) {
  await initProject(deps, projectRoot);
  return installTool(deps, projectRoot, toolId);
}

export { FIXTURE_DIR };
