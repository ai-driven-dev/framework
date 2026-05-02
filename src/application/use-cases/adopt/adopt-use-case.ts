import { join } from "node:path";
import { Manifest } from "../../../domain/models/manifest.js";
import { AIDD_DIR } from "../../../domain/models/paths.js";
import type { AssetProvider } from "../../../domain/ports/asset-provider.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { assertValidToolIds, type ToolId } from "../../../domain/tools/registry.js";
import { AlreadyInitializedError, InputRequiredError } from "../../errors.js";
import { CatalogUseCase } from "../shared/catalog-use-case.js";
import { GitignoreUseCase } from "../shared/gitignore-use-case.js";
import { type AdoptToolResult, AdoptToolsUseCase } from "./adopt-tools-use-case.js";

interface AdoptOptions {
  toolIds: ToolId[];
  docsDir: string;
  projectRoot: string;
  version: string;
}

interface AdoptResult {
  tools: AdoptToolResult[];
  totalRegistered: number;
}

export class AdoptUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly assets: AssetProvider
  ) {}

  async execute(options: AdoptOptions): Promise<AdoptResult> {
    const { toolIds, docsDir, projectRoot, version } = options;

    assertValidToolIds(toolIds);
    if (toolIds.length === 0) {
      throw new InputRequiredError(
        "No tools specified. Use --ai or --ide to specify at least one tool."
      );
    }
    const existing = await this.manifestRepo.load();
    if (existing !== null) throw new AlreadyInitializedError();
    await this.deleteLegacyConfig(projectRoot);

    const manifest = Manifest.create(docsDir);
    const toolResults = await new AdoptToolsUseCase(
      this.fs,
      this.hasher,
      this.logger,
      this.assets
    ).execute({
      toolIds,
      manifest,
      projectRoot,
      version,
    });
    await this.persistAdopt(manifest, docsDir, projectRoot);
    return {
      tools: toolResults,
      totalRegistered: toolResults.reduce((sum, r) => sum + r.registered.length, 0),
    };
  }

  /** Saves manifest, regenerates catalog, and writes gitignore entry. */
  private async persistAdopt(
    manifest: Manifest,
    docsDir: string,
    projectRoot: string
  ): Promise<void> {
    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });
    await new GitignoreUseCase(this.fs).execute(projectRoot, [`${AIDD_DIR}/cache/`]);
  }

  private async deleteLegacyConfig(projectRoot: string): Promise<void> {
    const configPath = join(projectRoot, AIDD_DIR, "config.json");
    if (await this.fs.fileExists(configPath)) {
      await this.fs.deleteFile(configPath);
    }
  }
}
