import { join } from "node:path";
import "../domain/tools/ai/claude.js";
import { AIDD_DIR } from "../domain/models/paths.js";
import "../domain/tools/ai/copilot.js";
import "../domain/tools/ai/cursor.js";
import "../domain/tools/ai/opencode.js";
import "../domain/tools/ide/vscode.js";
import { CLIOutput } from "../application/output.js";
import { validateRepoFormat } from "../domain/models/manifest.js";
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
import type { Prompter } from "../domain/ports/prompter.js";
import { CliUpdaterAdapter } from "./adapters/cli-updater-adapter.js";
import { CurrentVersionAdapter } from "./adapters/current-version-adapter.js";
import { FileSystemAdapter } from "./adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "./adapters/framework-loader-adapter.js";
import { FrameworkResolverAdapter } from "./adapters/framework-resolver-adapter.js";
import { GhCliAdapter } from "./adapters/gh-cli-adapter.js";
import { GitAdapter } from "./adapters/git-adapter.js";
import { HasherAdapter } from "./adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "./adapters/manifest-repository-adapter.js";
import { PlatformAdapter } from "./adapters/platform-adapter.js";
import { InquirerPrompterAdapter, SilentPrompterAdapter } from "./adapters/prompter-adapter.js";
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
  cliUpdater: CliUpdater;
  currentVersionProvider: CurrentVersionProvider;
  git: Git;
  platform: Platform;
  prompter: Prompter;
  authReader: AuthReader;
  authStorage: AuthStorage;
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
  const loader = new FrameworkLoaderAdapter();
  const logger = output ?? new CLIOutput(options.verbose);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
  const repoFromFlag = options.repo ?? process.env.AIDD_REPO;
  if (repoFromFlag !== undefined) {
    validateRepoFormat(repoFromFlag);
  }
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
  const prompter = process.stdout.isTTY
    ? new InquirerPrompterAdapter()
    : new SilentPrompterAdapter();
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
  };
  _cache.set(projectRoot, deps);
  return deps;
}
