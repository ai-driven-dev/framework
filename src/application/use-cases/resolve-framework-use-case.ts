import type { FrameworkResolved } from "../../domain/ports/framework-resolver.js";
import type { FrameworkResolver } from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";

interface ResolveOptions {
  framework?: string;
}

export async function resolveFramework(
  resolver: FrameworkResolver,
  logger: Logger,
  options: ResolveOptions
): Promise<FrameworkResolved> {
  if (options.framework) {
    logger.debug(`Using local framework: ${options.framework}`);
    const isTarball = options.framework.endsWith(".tar.gz") || options.framework.endsWith(".tgz");
    return resolver.resolve(
      isTarball ? { tarballPath: options.framework } : { localPath: options.framework }
    );
  }
  const resolved = await resolver.resolve({});
  if (resolved.source === "download") {
    logger.info("Downloading framework...");
  } else if (resolved.source === "cache") {
    logger.debug(`Using cached framework version ${resolved.version}`);
  }
  return resolved;
}
