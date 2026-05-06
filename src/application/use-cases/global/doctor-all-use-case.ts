import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { TokenProvider } from "../../../domain/ports/token-provider.js";
import { DoctorUseCase } from "../doctor-use-case.js";
import type { GlobalExecutionError } from "./update-all-use-case.js";

type DoctorReport = Awaited<ReturnType<DoctorUseCase["execute"]>>;

export interface DoctorAllResult {
  ai: DoctorReport | null;
  ide: DoctorReport | null;
  plugins: DoctorReport | null;
  healthy: boolean;
  errors: GlobalExecutionError[];
}

export class DoctorAllUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly authReader?: TokenProvider
  ) {}

  async execute(projectRoot: string): Promise<DoctorAllResult> {
    const errors: GlobalExecutionError[] = [];
    const doctorUseCase = new DoctorUseCase(
      this.fs,
      this.manifestRepo,
      this.hasher,
      this.logger,
      this.authReader
    );
    const ai = await this.runScope(
      () => doctorUseCase.execute({ projectRoot, category: "ai" }),
      "ai",
      errors
    );
    const ide = await this.runScope(
      () => doctorUseCase.execute({ projectRoot, category: "ide" }),
      "ide",
      errors
    );
    const plugins = await this.runScope(
      () => doctorUseCase.execute({ projectRoot }),
      "plugins",
      errors
    );
    const healthy = this.computeHealthy(ai, ide, plugins);
    return { ai, ide, plugins, healthy, errors };
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

  private computeHealthy(
    ai: DoctorReport | null,
    ide: DoctorReport | null,
    plugins: DoctorReport | null
  ): boolean {
    return (
      (ai === null || ai.healthy) &&
      (ide === null || ide.healthy) &&
      (plugins === null || plugins.healthy)
    );
  }
}
