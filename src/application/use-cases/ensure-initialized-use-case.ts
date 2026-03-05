import type { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { InitUseCase } from "./init-use-case.js";

interface EnsureInitOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
}

export async function ensureInitialized(
  manifestRepo: ManifestRepository,
  fs: FileSystem,
  loader: FrameworkLoader,
  hasher: Hasher,
  logger: Logger,
  options: EnsureInitOptions
): Promise<Manifest> {
  const existing = await manifestRepo.load();
  if (existing !== null) return existing;
  logger.info("No installation found. Initializing docs first...");
  const initUseCase = new InitUseCase(fs, manifestRepo, loader, hasher);
  const result = await initUseCase.execute({
    frameworkPath: options.frameworkPath,
    version: options.version,
    docsDir: options.docsDir,
    projectRoot: options.projectRoot,
  });
  logger.debug(`Initialized docs in ${result.docsDir}/ (${result.fileCount} files)`);
  return result.manifest;
}
