import { join } from "node:path";
import { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { AssetProvider } from "../../../domain/ports/asset-provider.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";

export interface InstallMemoryStubOptions {
  toolId: AiToolId;
  projectRoot: string;
  manifest: Manifest;
}

export class InstallMemoryStubUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly assets: AssetProvider
  ) {}

  async execute(options: InstallMemoryStubOptions): Promise<InstallationFile[]> {
    const stub = this.assets.loadMemoryStub(options.toolId);
    if (await this.shouldSkip(stub.fileName, options)) return [];
    return [
      new InstallationFile({
        relativePath: stub.fileName,
        content: stub.content,
        hash: this.hasher.hash(stub.content),
      }),
    ];
  }

  private async shouldSkip(
    relativePath: string,
    options: InstallMemoryStubOptions
  ): Promise<boolean> {
    const fullPath = join(options.projectRoot, relativePath);
    const exists = await this.fs.fileExists(fullPath);
    if (!exists) return false;
    if (options.manifest.isFileTracked(relativePath)) return false;
    this.logger.warn(`Skipping ${relativePath} — exists but not tracked by aidd`);
    return true;
  }
}
