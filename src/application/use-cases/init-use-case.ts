import { join } from "node:path";
import { Manifest } from "../../domain/models/manifest.js";
import { AIDD_DIR } from "../../domain/models/paths.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { getAllRegisteredTools, hasToolSignals } from "../../domain/tools/registry.js";
import { AiddFilesDetectedError, AlreadyInitializedError, NoManifestError } from "../errors.js";
import { CatalogUseCase } from "./shared/catalog-use-case.js";
import { GitignoreUseCase } from "./shared/gitignore-use-case.js";

interface InitOptions {
  docsDir?: string;
  explicitDocsDir?: string;
  projectRoot: string;
  force?: boolean;
  interactive?: boolean;
}

interface InitResult {
  docsDir: string;
  manifest: Manifest;
}

export class InitUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly prompter?: Prompter
  ) {}

  async checkPreconditions(
    options: Pick<InitOptions, "docsDir" | "projectRoot" | "force">
  ): Promise<void> {
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
        `Already initialized (docs in "${existing.docsDir}"). Use \`aidd init --force\` to recreate the docs directory, or \`aidd clean --force\` to reset completely.`
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

    const { docsDir, explicitDocsDir } = await this.resolveInitConfig(options);
    const resolvedInputDocsDir = docsDir ?? Manifest.DEFAULT_DOCS_DIR;
    Manifest.validateDocsDir(resolvedInputDocsDir);

    const existing = await this.manifestRepo.load();
    await this.checkPreconditions({ docsDir: resolvedInputDocsDir, projectRoot, force });
    const resolvedDocsDir =
      force && existing !== null && explicitDocsDir === undefined
        ? existing.docsDir
        : resolvedInputDocsDir;

    await this.fs.createDirectory(join(projectRoot, resolvedDocsDir));

    const manifest = this.buildManifest(existing, resolvedDocsDir, force);
    await this.persistInit(manifest, resolvedDocsDir, projectRoot, force);
    return { docsDir: resolvedDocsDir, manifest };
  }

  private buildManifest(
    existing: Manifest | null,
    resolvedDocsDir: string,
    force: boolean
  ): Manifest {
    return force && existing !== null
      ? existing.withDocsDir(resolvedDocsDir)
      : Manifest.create(resolvedDocsDir);
  }

  /** Saves manifest, regenerates catalog, and conditionally adds gitignore entry. */
  private async persistInit(
    manifest: Manifest,
    docsDir: string,
    projectRoot: string,
    force: boolean
  ): Promise<void> {
    // Init calls save + catalog + gitignore directly (not via PostInstallPipelineUseCase):
    // no tools are installed during init, so catalog generation uses an empty tool set.
    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });
    if (!force) {
      await new GitignoreUseCase(this.fs).execute(projectRoot, [`${AIDD_DIR}/cache/`]);
    }
  }

  /** Resolves interactive config (docsDir) if prompted, otherwise uses options as-is. */
  private async resolveInitConfig(
    options: InitOptions
  ): Promise<{ docsDir?: string; explicitDocsDir?: string }> {
    const interactive = options.interactive ?? false;
    const force = options.force ?? false;

    if (!interactive || force || options.docsDir !== undefined || this.prompter === undefined) {
      return {
        docsDir: options.docsDir,
        explicitDocsDir: options.explicitDocsDir,
      };
    }

    const docsDirInput = await this.prompter.input(
      "Documentation directory name:",
      Manifest.DEFAULT_DOCS_DIR
    );
    const docsDir = docsDirInput || Manifest.DEFAULT_DOCS_DIR;

    return { docsDir, explicitDocsDir: docsDir };
  }
}
