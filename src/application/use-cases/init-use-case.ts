import { join } from "node:path";
import { Manifest } from "../../domain/models/manifest.js";
import { AIDD_DIR, DOCS_DIR } from "../../domain/models/paths.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { getAllRegisteredTools, hasToolSignals } from "../../domain/tools/registry.js";
import { AiddFilesDetectedError, AlreadyInitializedError, NoManifestError } from "../errors.js";
import { CatalogUseCase } from "./shared/catalog-use-case.js";
import { GitignoreUseCase } from "./shared/gitignore-use-case.js";

interface InitOptions {
  projectRoot: string;
  force?: boolean;
}

interface InitResult {
  docsDir: string;
  manifest: Manifest;
}

export class InitUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository
  ) {}

  async checkPreconditions(options: Pick<InitOptions, "projectRoot" | "force">): Promise<void> {
    const { projectRoot, force = false } = options;
    const existing = await this.manifestRepo.load();

    if (force) {
      if (existing === null) {
        throw new NoManifestError();
      }
      return;
    }

    if (existing !== null) {
      throw new AlreadyInitializedError(
        `Already initialized (docs in "${DOCS_DIR}"). Use \`aidd init --force\` to recreate the docs directory, or \`aidd clean --force\` to reset completely.`
      );
    }

    if (await this.hasAiddSignals(projectRoot)) {
      throw new AiddFilesDetectedError();
    }
  }

  private async hasAiddSignals(projectRoot: string): Promise<boolean> {
    for (const tool of getAllRegisteredTools().values()) {
      if ((await hasToolSignals(this.fs, tool, projectRoot)).length > 0) return true;
    }
    return false;
  }

  async execute(options: InitOptions): Promise<InitResult> {
    const { projectRoot, force = false } = options;

    const existing = await this.manifestRepo.load();
    await this.checkPreconditions({ projectRoot, force });

    await this.fs.createDirectory(join(projectRoot, DOCS_DIR));

    const manifest = force && existing !== null ? existing : Manifest.create();
    await this.persistInit(manifest, projectRoot, force);
    return { docsDir: DOCS_DIR, manifest };
  }

  /** Saves manifest, regenerates catalog, and conditionally adds gitignore entry. */
  private async persistInit(
    manifest: Manifest,
    projectRoot: string,
    force: boolean
  ): Promise<void> {
    // Init calls save + catalog + gitignore directly (not via PostInstallPipelineUseCase):
    // no tools are installed during init, so catalog generation uses an empty tool set.
    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir: DOCS_DIR, projectRoot });
    if (!force) {
      await new GitignoreUseCase(this.fs).execute(projectRoot, [`${AIDD_DIR}/cache/`]);
    }
  }
}
