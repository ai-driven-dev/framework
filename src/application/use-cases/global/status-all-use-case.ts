import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { StatusUseCase } from "../status-use-case.js";
import type { GlobalExecutionError } from "./update-all-use-case.js";

export interface StatusAllResult {
  aiTools: Awaited<ReturnType<StatusUseCase["execute"]>>;
  ideTools: Awaited<ReturnType<StatusUseCase["execute"]>>;
  plugins: Awaited<ReturnType<StatusUseCase["execute"]>>;
  errors: GlobalExecutionError[];
}

export class StatusAllUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger,
    private readonly hasher: Hasher
  ) {}

  async execute(projectRoot: string): Promise<StatusAllResult> {
    const errors: GlobalExecutionError[] = [];
    const useCase = new StatusUseCase(this.fs, this.manifestRepo, this.logger, this.hasher);
    const aiTools = await this.runScope(
      () => useCase.execute({ projectRoot, category: "ai" }),
      "ai",
      errors
    );
    const ideTools = await this.runScope(
      () => useCase.execute({ projectRoot, category: "ide" }),
      "ide",
      errors
    );
    const plugins = await this.runScope(
      () => useCase.execute({ projectRoot, filterToolId: undefined }),
      "plugins",
      errors
    );
    return {
      aiTools: aiTools ?? emptyReport(),
      ideTools: ideTools ?? emptyReport(),
      plugins: plugins ?? emptyReport(),
      errors,
    };
  }

  private async runScope<T>(
    fn: () => Promise<T>,
    scope: string,
    errors: GlobalExecutionError[]
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      errors.push({ scope, message: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }
}

function emptyReport() {
  return { tools: [], pluginDrift: [], inSync: true };
}
