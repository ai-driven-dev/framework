import { join } from "node:path";
import "../domain/tools/ai/claude.js";
import { AIDD_DIR, PLUGIN_CACHE_SUBDIR } from "../domain/models/paths.js";
import "../domain/tools/ai/codex.js";
import "../domain/tools/ai/copilot.js";
import "../domain/tools/ai/cursor.js";
import "../domain/tools/ai/opencode.js";
import "../domain/tools/ide/vscode.js";
import { CLIOutput } from "../application/output.js";
import { PluginAddUseCase } from "../application/use-cases/plugin/plugin-add-use-case.js";
import { PluginListUseCase } from "../application/use-cases/plugin/plugin-list-use-case.js";
import { PluginRemoveUseCase } from "../application/use-cases/plugin/plugin-remove-use-case.js";
import { PluginUpdateUseCase } from "../application/use-cases/plugin/plugin-update-use-case.js";
import type { FileSystem } from "../domain/ports/file-system.js";
import type { FrameworkLoader } from "../domain/ports/framework-loader.js";
import type { FrameworkResolver } from "../domain/ports/framework-resolver.js";
import type { Hasher } from "../domain/ports/hasher.js";
import type { Logger } from "../domain/ports/logger.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import type { Platform } from "../domain/ports/platform.js";
import type { PluginCatalogRepository } from "../domain/ports/plugin-catalog-repository.js";
import type { PluginDistributionReader } from "../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../domain/ports/plugin-fetcher.js";
import type { Prompter } from "../domain/ports/prompter.js";
import type { SelfUpdater } from "../domain/ports/self-updater.js";
import type { VersionControl } from "../domain/ports/version-control.js";
import type { VersionReader } from "../domain/ports/version-reader.js";
import { CurrentVersionAdapter } from "./adapters/current-version-adapter.js";
import { FileSystemAdapter } from "./adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "./adapters/framework-loader-adapter.js";
import { FrameworkResolverAdapter } from "./adapters/framework-resolver-adapter.js";
import { GhCliAdapter } from "./adapters/gh-cli-adapter.js";
import { GitAdapter } from "./adapters/git-adapter.js";
import { HasherAdapter } from "./adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "./adapters/manifest-repository-adapter.js";
import { PlatformAdapter } from "./adapters/platform-adapter.js";
import { PluginCatalogRepositoryAdapter } from "./adapters/plugin-catalog-repository-adapter.js";
import { PluginDistributionReaderAdapter } from "./adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "./adapters/plugin-fetcher-adapter.js";
import { InquirerPrompterAdapter, SilentPrompterAdapter } from "./adapters/prompter-adapter.js";
import { SelfUpdaterAdapter } from "./adapters/self-updater-adapter.js";
import { AuthReader } from "./auth/auth-reader.js";
import { AuthStorage } from "./auth/auth-storage.js";
import { FrameworkCache } from "./cache/framework-cache.js";
import { HttpClient } from "./http/http-client.js";
import { TarExtractor } from "./tar/tar-extractor.js";

interface GlobalOptions {
  verbose: boolean;
  repo?: string;
}

interface Deps {
  fs: FileSystem;
  manifestRepo: ManifestRepository;
  loader: FrameworkLoader;
  hasher: Hasher;
  logger: Logger;
  resolver: FrameworkResolver;
  cliUpdater: SelfUpdater;
  currentVersionProvider: VersionReader;
  git: VersionControl;
  platform: Platform;
  prompter: Prompter;
  authReader: AuthReader;
  authStorage: AuthStorage;
  pluginCatalogRepository: PluginCatalogRepository;
  pluginFetcher: PluginFetcher;
  pluginDistributionReader: PluginDistributionReader;
  pluginAddUseCase: PluginAddUseCase;
  pluginRemoveUseCase: PluginRemoveUseCase;
  pluginListUseCase: PluginListUseCase;
  pluginUpdateUseCase: PluginUpdateUseCase;
}

const _cache = new Map<string, Deps>();

export function createMenuDeps(projectRoot: string): {
  manifestRepo: ManifestRepository;
  prompter: Prompter;
} {
  return {
    manifestRepo: new ManifestRepositoryAdapter(projectRoot),
    prompter: process.stdout.isTTY ? new InquirerPrompterAdapter() : new SilentPrompterAdapter(),
  };
}

export async function createDeps(
  projectRoot: string,
  options: GlobalOptions,
  output?: CLIOutput
): Promise<Deps> {
  const cached = _cache.get(projectRoot);
  if (cached !== undefined) return cached;
  const hasher = new HasherAdapter();
  const fs = new FileSystemAdapter(hasher);
  const pluginCatalogRepository = new PluginCatalogRepositoryAdapter(fs);
  const pluginDistributionReader = new PluginDistributionReaderAdapter(fs);
  const loader = new FrameworkLoaderAdapter();
  const logger = output ?? new CLIOutput(options.verbose);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
  const repoFromFlag = options.repo ?? process.env.AIDD_REPO;
  const manifestForRepo = await manifestRepo.load().catch(() => null);
  const effectiveRepo = repoFromFlag ?? manifestForRepo?.repo ?? "ai-driven-dev/aidd-framework";
  const cacheDir = join(projectRoot, AIDD_DIR, "cache");
  const http = new HttpClient();
  const tar = new TarExtractor();
  const cache = new FrameworkCache(cacheDir);
  const authStorage = new AuthStorage();
  const ghCliAdapter = new GhCliAdapter();
  const authReader = new AuthReader(authStorage, projectRoot, logger, ghCliAdapter);
  const token = await authReader.resolve();
  const pluginFetcher = new PluginFetcherAdapter(
    fs,
    token ?? undefined,
    process.env.AIDD_GITLAB_TOKEN
  );
  const gitCacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
  const resolver = new FrameworkResolverAdapter(
    http,
    tar,
    cache,
    {
      defaultRepo: effectiveRepo,
      defaultToken: token ?? undefined,
      gitFetcher: pluginFetcher,
      gitCacheDir,
    },
    logger
  );
  const cliUpdater = new SelfUpdaterAdapter(http, { token: token ?? undefined });
  const currentVersionProvider = new CurrentVersionAdapter();
  const git = new GitAdapter(fs);
  const platform = new PlatformAdapter();
  const prompter = process.stdout.isTTY
    ? new InquirerPrompterAdapter()
    : new SilentPrompterAdapter();
  const pluginAddUseCase = new PluginAddUseCase(
    fs,
    manifestRepo,
    pluginFetcher,
    pluginDistributionReader,
    hasher
  );
  const pluginRemoveUseCase = new PluginRemoveUseCase(fs, manifestRepo);
  const pluginListUseCase = new PluginListUseCase(manifestRepo);
  const pluginUpdateUseCase = new PluginUpdateUseCase(
    fs,
    manifestRepo,
    pluginFetcher,
    pluginDistributionReader,
    hasher
  );
  const deps: Deps = {
    fs,
    manifestRepo,
    loader,
    hasher,
    logger,
    resolver,
    cliUpdater,
    currentVersionProvider,
    git,
    platform,
    prompter,
    authReader,
    authStorage,
    pluginCatalogRepository,
    pluginFetcher,
    pluginDistributionReader,
    pluginAddUseCase,
    pluginRemoveUseCase,
    pluginListUseCase,
    pluginUpdateUseCase,
  };
  _cache.set(projectRoot, deps);
  return deps;
}
