import type { Manifest } from "../../../domain/models/manifest.js";
import { AIDD_DIR } from "../../../domain/models/paths.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { CatalogUseCase } from "./catalog-use-case.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";

interface PostInstallPipelineOptions {
  projectRoot: string;
  manifest: Manifest;
  docsDir: string;
}

export class PostInstallPipelineUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository
  ) {}

  async execute(options: PostInstallPipelineOptions): Promise<void> {
    const { projectRoot, manifest, docsDir } = options;

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });
    await new GitignoreUseCase(this.fs).execute(projectRoot, [`${AIDD_DIR}/cache/`]);
  }
}
