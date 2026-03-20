import type {
  FrameworkResolved,
  FrameworkResolver,
} from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";

interface ResolveOptions {
  path?: string;
  repo?: string;
  release?: string;
  from?: string;
}

function isLocalPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.endsWith(".tar.gz") ||
    value.endsWith(".tgz")
  );
}

export async function resolveFramework(
  resolver: FrameworkResolver,
  logger: Logger,
  options: ResolveOptions
): Promise<FrameworkResolved> {
  if (options.from) {
    return resolveFramework(
      resolver,
      logger,
      isLocalPath(options.from) ? { path: options.from } : { release: options.from }
    );
  }
  if (options.path) {
    if (options.repo) {
      logger.info(`Using local framework at ${options.path} (remote source ignored)`);
    }
    logger.debug(`Using local framework: ${options.path}`);
    const isTarball = options.path.endsWith(".tar.gz") || options.path.endsWith(".tgz");
    return resolver.resolve(
      isTarball ? { tarballPath: options.path } : { localPath: options.path }
    );
  }
  return resolver.resolve(options.release ? { version: options.release } : {});
}

export async function resolveFrameworkWithFallback(
  resolver: FrameworkResolver,
  logger: Logger,
  options: ResolveOptions & { pinnedVersion?: string }
): Promise<FrameworkResolved> {
  // Local path bypasses version pinning entirely — no fallback applies.
  if (options.path) {
    return resolveFramework(resolver, logger, { path: options.path });
  }
  try {
    return await resolveFramework(resolver, logger, {
      release: options.pinnedVersion ?? options.release,
    });
  } catch {
    logger.warn("Pinned version unavailable, falling back to latest.");
    return resolveFramework(resolver, logger, {});
  }
}
