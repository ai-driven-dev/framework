import { join } from "node:path";
import { remapDocsPath, rewriteDocsContent } from "../../domain/models/docs-transform.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { writeCatalog } from "./catalog-use-case.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";

export interface InitOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  explicitDocsDir?: string;
  projectRoot: string;
  force?: boolean;
  repo?: string;
}

export interface InitResult {
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
    private readonly logger: Logger
  ) {}

  async checkPreconditions(
    options: Pick<InitOptions, "docsDir" | "projectRoot" | "force">
  ): Promise<void> {
    const { docsDir, projectRoot, force = false } = options;
    const existing = await this.manifestRepo.load();

    if (force) {
      if (existing === null) {
        throw new Error("No AIDD installation found. Run `aidd init` first.");
      }
      return;
    }

    if (existing !== null) {
      throw new Error(
        `Already initialized (docs in "${existing.docsDir}"). Use \`aidd init --force\` to re-copy docs, or \`aidd clean --force\` to reset completely.`
      );
    }

    const aiddSignals = [
      join(projectRoot, docsDir),
      join(projectRoot, ".claude"),
      join(projectRoot, ".cursor"),
      join(projectRoot, ".github", "copilot-instructions.md"),
    ];
    for (const signalPath of aiddSignals) {
      if (await this.fs.fileExists(signalPath)) {
        throw new Error(
          "AIDD files detected. Use `aidd adopt` to migrate your existing installation."
        );
      }
    }
  }

  async execute(options: InitOptions): Promise<InitResult> {
    const {
      frameworkPath,
      version,
      docsDir,
      explicitDocsDir,
      projectRoot,
      force = false,
      repo,
    } = options;

    const existing = await this.manifestRepo.load();

    // After checkPreconditions: existing is non-null in force mode and null in non-force mode.
    // In --force mode: use explicitly provided --docs-dir if given; otherwise keep existing.
    const resolvedDocsDir =
      force && existing !== null && explicitDocsDir === undefined ? existing.docsDir : docsDir;
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
    await writeCatalog(manifest, resolvedDocsDir, projectRoot, this.fs);

    if (!force) {
      await new GitignoreUseCase(this.fs).execute(projectRoot, [".aidd/cache/"]);
    }

    return { docsDir: resolvedDocsDir, fileCount: generated.length, manifest };
  }
}
