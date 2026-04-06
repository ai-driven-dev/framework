import type { FrameworkDescriptor } from "../../../domain/models/framework-descriptor.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Git } from "../../../domain/ports/git.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import { CatalogUseCase } from "../catalog-use-case.js";
import { GitignoreUseCase } from "../gitignore-use-case.js";
import { MemoryScriptUseCase } from "../memory-script-use-case.js";

interface PostInstallPipelineOptions {
  projectRoot: string;
  version: string;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  manifest: Manifest;
  docsDir: string;
}

export class PostInstallPipelineUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly git: Git,
    private readonly prompter?: Prompter
  ) {}

  async execute(options: PostInstallPipelineOptions): Promise<void> {
    const { projectRoot, version, descriptor, contentFiles, manifest, docsDir } = options;

    await new MemoryScriptUseCase(this.fs, this.hasher, this.git, this.prompter).execute({
      projectRoot,
      version,
      descriptor,
      contentFiles,
      manifest,
    });

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });
    await new GitignoreUseCase(this.fs).execute(projectRoot, [".aidd/cache/"]);
  }
}
