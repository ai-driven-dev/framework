import type { Manifest } from "../../../domain/models/manifest.js";
import { AIDD_DIR } from "../../../domain/models/paths.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";

interface PostInstallPipelineOptions {
  projectRoot: string;
  manifest: Manifest;
}

export class PostInstallPipelineUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository
  ) {}

  async execute(options: PostInstallPipelineOptions): Promise<void> {
    const { projectRoot, manifest } = options;

    await this.manifestRepo.save(manifest);
    await new GitignoreUseCase(this.fs).execute(projectRoot, [`${AIDD_DIR}/cache/`]);
  }
}
