import { join } from "node:path";
import "../domain/tools/claude.js";
import "../domain/tools/copilot.js";
import "../domain/tools/cursor.js";
import "../domain/tools/opencode.js";
import { CLIOutput } from "../application/output.js";
import type { CliUpdater } from "../domain/ports/cli-updater.js";
import type { CurrentVersionProvider } from "../domain/ports/current-version-provider.js";
import type { FileSystem } from "../domain/ports/file-system.js";
import type { FrameworkLoader } from "../domain/ports/framework-loader.js";
import type { FrameworkResolver } from "../domain/ports/framework-resolver.js";
import type { Git } from "../domain/ports/git.js";
import type { Hasher } from "../domain/ports/hasher.js";
import type { Logger } from "../domain/ports/logger.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import type { Platform } from "../domain/ports/platform.js";
import { CliUpdaterAdapter } from "./adapters/cli-updater-adapter.js";
import { CurrentVersionAdapter } from "./adapters/current-version-adapter.js";
import { FileSystemAdapter } from "./adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "./adapters/framework-loader-adapter.js";
import {
  FrameworkResolverAdapter,
  validateRepoFormat,
} from "./adapters/framework-resolver-adapter.js";
import { GitAdapter } from "./adapters/git-adapter.js";
import { HasherAdapter } from "./adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "./adapters/manifest-repository-adapter.js";
import { PlatformAdapter } from "./adapters/platform-adapter.js";
import { TokenResolver } from "./auth/token-resolver.js";
import { FrameworkCache } from "./cache/framework-cache.js";
import { HttpClient } from "./http/http-client.js";
import { TarExtractor } from "./tar/tar-extractor.js";

interface GlobalOptions {
  verbose: boolean;
  repo?: string;
  token?: string;
  framework?: string;
}

interface Deps {
  fs: FileSystem;
  manifestRepo: ManifestRepository;
  loader: FrameworkLoader;
  hasher: Hasher;
  logger: Logger;
  resolver: FrameworkResolver;
  cliUpdater: CliUpdater;
  currentVersionProvider: CurrentVersionProvider;
  git: Git;
  platform: Platform;
}

export async function createDeps(
  projectRoot: string,
  options: GlobalOptions,
  output?: CLIOutput
): Promise<Deps> {
  const hasher = new HasherAdapter();
  const fs = new FileSystemAdapter(hasher);
  const loader = new FrameworkLoaderAdapter();
  const logger = output ?? new CLIOutput(options.verbose);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
  const repoFromFlag = options.repo ?? process.env.AIDD_REPO;
  if (repoFromFlag !== undefined) {
    validateRepoFormat(repoFromFlag);
  }
  const manifestForRepo = await manifestRepo.load().catch(() => null);
  const effectiveRepo = repoFromFlag ?? manifestForRepo?.repo ?? "ai-driven-dev/aidd-framework";
  const cacheDir = join(projectRoot, ".aidd", "cache");
  const http = new HttpClient();
  const tar = new TarExtractor();
  const cache = new FrameworkCache(cacheDir);
  const tokenResolver = new TokenResolver();
  const token = tokenResolver.resolve({ flag: options.token, logger });
  const resolver = new FrameworkResolverAdapter(
    http,
    tar,
    cache,
    {
      defaultRepo: effectiveRepo,
      defaultToken: token ?? undefined,
    },
    logger
  );
  const cliUpdater = new CliUpdaterAdapter(http, { token: token ?? undefined });
  const currentVersionProvider = new CurrentVersionAdapter();
  const git = new GitAdapter(fs);
  const platform = new PlatformAdapter();
  return {
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
  };
}
