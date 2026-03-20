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
import { AiddFilesDetectedError, NoManifestError } from "../errors.js";
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
      throw new Error(
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
      if (await hasToolSignals(this.fs, tool, projectRoot)) return true;
    }
    return false;
  }

  async execute(options: InitOptions): Promise<InitResult> {
    const { frameworkPath, version, projectRoot, force = false } = options;
    const interactive = options.interactive ?? false;

    let docsDir = options.docsDir;
    let explicitDocsDir = options.explicitDocsDir;
    let repo = options.repo;

    if (interactive && !force && docsDir === undefined && this.prompter !== undefined) {
      const docsDirInput = await this.prompter.input(
        "Documentation directory name:",
        Manifest.DEFAULT_DOCS_DIR
      );
      docsDir = docsDirInput || Manifest.DEFAULT_DOCS_DIR;
      explicitDocsDir = docsDir;
      const repoInput = await this.prompter.input(
        "Framework repository (owner/repo, leave blank to skip):",
        ""
      );
      if (repoInput !== "") repo = repoInput;
    }

    const resolvedInputDocsDir = docsDir ?? Manifest.DEFAULT_DOCS_DIR;
    Manifest.validateDocsDir(resolvedInputDocsDir);

    await this.checkPreconditions({ docsDir: resolvedInputDocsDir, projectRoot, force, repo });

    const existing = await this.manifestRepo.load();

    // In --force mode: use explicitly provided --docs-dir if given; otherwise keep existing.
    const resolvedDocsDir =
      force && existing !== null && explicitDocsDir === undefined
        ? existing.docsDir
        : resolvedInputDocsDir;

    const { descriptor, docsFiles } = await this.loader.loadFromDirectory(frameworkPath, version);

    const generated: GeneratedFile[] = [];
    for (const [frameworkRelPath, rawContent] of docsFiles.entries()) {
      if (frameworkRelPath.endsWith("CATALOG.md")) continue;
      const outputRelPath = remapDocsPath(frameworkRelPath, resolvedDocsDir);
      const outputPath = join(projectRoot, outputRelPath);
      const content = rewriteDocsContent(rawContent, resolvedDocsDir);
      const newHash = this.hasher.hash(content);

      if (force && (await this.fs.fileExists(outputPath))) {
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

    if (force && existing !== null) {
      const newPaths = new Set(generated.map((f) => f.relativePath));
      for (const oldFile of existing.getDocsFiles()) {
        if (!newPaths.has(oldFile.relativePath)) {
          await this.fs.deleteFile(join(projectRoot, oldFile.relativePath));
        }
      }
    }

    const manifest =
      force && existing !== null
        ? existing.withDocsDir(resolvedDocsDir)
        : Manifest.create(resolvedDocsDir, repo);
    manifest.addDocs(descriptor.version, generated);
    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir: resolvedDocsDir, projectRoot });

    if (!force) {
      await new GitignoreUseCase(this.fs).execute(projectRoot, [".aidd/cache/"]);
    }

    return { docsDir: resolvedDocsDir, fileCount: generated.length, manifest };
  }
}
