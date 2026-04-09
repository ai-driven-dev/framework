import { join } from "node:path";
import { remapDocsPath, rewriteDocsContent } from "../../domain/models/docs.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import { getAllRegisteredTools, hasToolSignals } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { AiddFilesDetectedError, AlreadyInitializedError, NoManifestError } from "../errors.js";
import { CatalogUseCase } from "./catalog-use-case.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";

interface InitOptions {
  frameworkPath: string;
  version: string;
  docsDir?: string;
  explicitDocsDir?: string;
  projectRoot: string;
  force?: boolean;
  repo?: string;
  interactive?: boolean;
}

interface InitResult {
  docsDir: string;
  fileCount: number;
  manifest: Manifest;
}

export class InitUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter?: Prompter
  ) {}

  async checkPreconditions(
    options: Pick<InitOptions, "docsDir" | "projectRoot" | "force" | "repo">
  ): Promise<void> {
    const { docsDir, projectRoot, force = false, repo } = options;
    const resolvedDocsDir = docsDir ?? Manifest.DEFAULT_DOCS_DIR;
    const existing = await this.manifestRepo.load();

    if (force) {
      if (existing === null) {
        throw new NoManifestError(repo);
      }
      return;
    }

    if (existing !== null) {
      throw new AlreadyInitializedError(
        `Already initialized (docs in "${existing.docsDir}"). Use \`aidd init --force\` to re-copy docs, or \`aidd clean --force\` to reset completely.`
      );
    }

    if (await this.fs.fileExists(join(projectRoot, resolvedDocsDir))) {
      throw new AiddFilesDetectedError(repo);
    }

    if (await this.hasAiddSignals(projectRoot)) {
      throw new AiddFilesDetectedError(repo);
    }
  }

  private async hasAiddSignals(projectRoot: string): Promise<boolean> {
    for (const tool of getAllRegisteredTools().values()) {
      if ((await hasToolSignals(this.fs, tool, projectRoot)).length > 0) return true;
    }
    return false;
  }

  async execute(options: InitOptions): Promise<InitResult> {
    const { frameworkPath, version, projectRoot, force = false } = options;

    const { docsDir, explicitDocsDir, repo } = await this.resolveInitConfig(options);
    const resolvedInputDocsDir = docsDir ?? Manifest.DEFAULT_DOCS_DIR;
    Manifest.validateDocsDir(resolvedInputDocsDir);

    const existing = await this.manifestRepo.load();
    await this.checkPreconditions({ docsDir: resolvedInputDocsDir, projectRoot, force, repo });
    const resolvedDocsDir =
      force && existing !== null && explicitDocsDir === undefined
        ? existing.docsDir
        : resolvedInputDocsDir;

    const { descriptor, docsFiles } = await this.loader.loadFromDirectory(frameworkPath, version);
    const generated = await this.writeDocsFiles(
      docsFiles,
      resolvedDocsDir,
      projectRoot,
      force,
      existing
    );
    if (force && existing !== null)
      await this.removeStaleDocsFiles(generated, existing, projectRoot);

    const manifest = this.buildManifest(existing, resolvedDocsDir, repo, force);
    manifest.addDocs(descriptor.version, generated);
    await this.persistInit(manifest, resolvedDocsDir, projectRoot, force);
    return { docsDir: resolvedDocsDir, fileCount: generated.length, manifest };
  }

  private buildManifest(
    existing: Manifest | null,
    resolvedDocsDir: string,
    repo: string | undefined,
    force: boolean
  ): Manifest {
    return force && existing !== null
      ? existing.withDocsDir(resolvedDocsDir)
      : Manifest.create(resolvedDocsDir, repo);
  }

  /** Saves manifest, regenerates catalog, and conditionally adds gitignore entry. */
  private async persistInit(
    manifest: Manifest,
    docsDir: string,
    projectRoot: string,
    force: boolean
  ): Promise<void> {
    // Init calls save + catalog + gitignore directly (3 of the 4 post-install steps).
    // MemoryScriptUseCase is intentionally absent here: no tools are installed during init,
    // so there is no memory bank content to write. PostInstallPipelineUseCase is used by
    // InstallUseCase and UpdateUseCase where tool installation has already happened.
    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });
    if (!force) {
      await new GitignoreUseCase(this.fs).execute(projectRoot, [".aidd/cache/"]);
    }
  }

  /** Resolves interactive config (docsDir, repo) if prompted, otherwise uses options as-is. */
  private async resolveInitConfig(
    options: InitOptions
  ): Promise<{ docsDir?: string; explicitDocsDir?: string; repo?: string }> {
    const interactive = options.interactive ?? false;
    const force = options.force ?? false;

    if (!interactive || force || options.docsDir !== undefined || this.prompter === undefined) {
      return {
        docsDir: options.docsDir,
        explicitDocsDir: options.explicitDocsDir,
        repo: options.repo,
      };
    }

    const docsDirInput = await this.prompter.input(
      "Documentation directory name:",
      Manifest.DEFAULT_DOCS_DIR
    );
    const docsDir = docsDirInput || Manifest.DEFAULT_DOCS_DIR;
    const repoInput = await this.prompter.input(
      "Framework repository (owner/repo, leave blank to skip):",
      options.repo ?? ""
    );
    const repo = repoInput !== "" ? repoInput.trim() : options.repo;

    return { docsDir, explicitDocsDir: docsDir, repo };
  }

  /** Writes docs files to disk, skipping CATALOG.md. Returns the list of generated files. */
  private async writeDocsFiles(
    docsFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    force: boolean,
    existing: Manifest | null
  ): Promise<GeneratedFile[]> {
    const generated: GeneratedFile[] = [];
    for (const [frameworkRelPath, rawContent] of docsFiles.entries()) {
      if (frameworkRelPath.endsWith("CATALOG.md")) continue;
      const outputRelPath = remapDocsPath(frameworkRelPath, docsDir);
      const outputPath = join(projectRoot, outputRelPath);
      const content = rewriteDocsContent(rawContent, docsDir);
      const newHash = this.hasher.hash(content);

      if (force && existing !== null && (await this.fs.fileExists(outputPath))) {
        const diskHash = await this.fs.readFileHash(outputPath);
        if (!diskHash.equals(newHash)) {
          this.logger.warn(`Overwriting modified file: ${outputRelPath}`);
          await this.fs.writeFile(outputPath, content);
        }
      } else {
        await this.fs.writeFile(outputPath, content);
      }

      generated.push(new GeneratedFile({ relativePath: outputRelPath, content, hash: newHash }));
    }
    return generated;
  }

  private async removeStaleDocsFiles(
    generated: GeneratedFile[],
    existing: Manifest,
    projectRoot: string
  ): Promise<void> {
    const newPaths = new Set(generated.map((f) => f.relativePath));
    for (const oldFile of existing.getDocsFiles()) {
      if (!newPaths.has(oldFile.relativePath)) {
        await this.fs.deleteFile(join(projectRoot, oldFile.relativePath));
      }
    }
  }
}
