import type {
  FrameworkResolved,
  FrameworkResolver,
} from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";

interface ResolveOptions {
  framework?: string;
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
      isLocalPath(options.from) ? { framework: options.from } : { release: options.from }
    );
  }
  if (options.framework) {
    logger.debug(`Using local framework: ${options.framework}`);
    const isTarball = options.framework.endsWith(".tar.gz") || options.framework.endsWith(".tgz");
    return resolver.resolve(
      isTarball ? { tarballPath: options.framework } : { localPath: options.framework }
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
  if (options.framework) {
    return resolveFramework(resolver, logger, { framework: options.framework });
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
