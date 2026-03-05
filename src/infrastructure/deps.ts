import { join } from "node:path";
import type { Settings } from "../domain/models/settings.js";
import type { FileSystem } from "../domain/ports/file-system.js";
import type { FrameworkLoader } from "../domain/ports/framework-loader.js";
import type { FrameworkResolver } from "../domain/ports/framework-resolver.js";
import type { Hasher } from "../domain/ports/hasher.js";
import type { Logger } from "../domain/ports/logger.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import { FileSystemAdapter } from "./adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "./adapters/framework-loader-adapter.js";
import { FrameworkResolverAdapter } from "./adapters/framework-resolver-adapter.js";
import { HasherAdapter } from "./adapters/hasher-adapter.js";
import { LoggerAdapter } from "./adapters/logger-adapter.js";
import { ManifestRepositoryAdapter } from "./adapters/manifest-repository-adapter.js";
import { SettingsRepositoryAdapter } from "./adapters/settings-repository-adapter.js";
import { TokenResolver } from "./auth/token-resolver.js";
import { FrameworkCache } from "./cache/framework-cache.js";
import { HttpClient } from "./http/http-client.js";
import { TarExtractor } from "./tar/tar-extractor.js";

export interface GlobalOptions {
  verbose: boolean;
  repo?: string;
  token?: string;
  framework?: string;
}

export interface Deps {
  fs: FileSystem;
  manifestRepo: ManifestRepository;
  loader: FrameworkLoader;
  hasher: Hasher;
  logger: Logger;
  resolver: FrameworkResolver;
  settings: Settings;
}

export async function createDeps(projectRoot: string, options: GlobalOptions): Promise<Deps> {
  const hasher = new HasherAdapter();
  const fs = new FileSystemAdapter(hasher);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
  const loader = new FrameworkLoaderAdapter();
  const logger = new LoggerAdapter(options.verbose);
  const settingsRepo = new SettingsRepositoryAdapter(projectRoot);
  const settings = await settingsRepo.load();
  const effectiveRepo = options.repo ?? settings.repo;
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
  return { fs, manifestRepo, loader, hasher, logger, resolver, settings };
}
