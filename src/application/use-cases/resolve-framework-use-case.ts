import { isLocalPath } from "../../domain/models/framework.js";
import type {
  FrameworkResolved,
  FrameworkResolver,
} from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { TokenProvider } from "../../domain/ports/token-provider.js";
import { RequireAuthUseCase } from "./auth/require-auth-use-case.js";

interface ResolveFrameworkOptions {
  path?: string;
  repo?: string;
  release?: string;
  from?: string;
  pinnedVersion?: string;
}

export class ResolveFrameworkUseCase {
  constructor(
    private readonly resolver: FrameworkResolver,
    private readonly logger: Logger,
    private readonly authReader?: TokenProvider
  ) {}

  async execute(options: ResolveFrameworkOptions): Promise<FrameworkResolved> {
    const isLocal = options.path
      ? isLocalPath(options.path)
      : options.from
        ? isLocalPath(options.from)
        : false;

    if (this.authReader && !isLocal) {
      await new RequireAuthUseCase(this.authReader).execute();
    }

    return this.resolve(options);
  }

  private async resolve(options: ResolveFrameworkOptions): Promise<FrameworkResolved> {
    if (options.from) {
      return this.resolve(
        isLocalPath(options.from) ? { path: options.from } : { release: options.from }
      );
    }

    if (options.path) {
      if (options.repo) {
        this.logger.info(`Using local framework at ${options.path} (remote source ignored)`);
      }
      this.logger.debug(`Using local framework: ${options.path}`);
      const isTarball = options.path.endsWith(".tar.gz") || options.path.endsWith(".tgz");
      return this.resolver.resolve(
        isTarball ? { tarballPath: options.path } : { localPath: options.path }
      );
    }

    if (options.pinnedVersion) {
      try {
        return await this.resolver.resolve({ version: options.pinnedVersion });
      } catch {
        this.logger.warn("Pinned version unavailable, falling back to latest.");
        return this.resolver.resolve({});
      }
    }

    return this.resolver.resolve(options.release ? { version: options.release } : {});
  }
}
