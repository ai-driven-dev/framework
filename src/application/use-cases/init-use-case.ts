import { join } from "node:path";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { writeCatalog } from "./catalog-use-case.js";
import { GitignoreUseCase } from "./gitignore-use-case.js";

const FRAMEWORK_DOCS_PREFIX = "aidd_docs";

export interface InitOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  force?: boolean;
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

  async execute(options: InitOptions): Promise<InitResult> {
    const { frameworkPath, version, docsDir, projectRoot, force = false } = options;

    const existing = await this.manifestRepo.load();

    if (force) {
      if (existing === null) {
        throw new Error("No AIDD installation found. Run `aidd init` first.");
      }
    } else {
      if (existing !== null) {
        throw new Error(
          `Already initialized (docs in "${existing.docsDir}"). Run \`aidd clean\` first to re-initialize.`
        );
      }
      const docsDirPath = join(projectRoot, docsDir);
      if (await this.fs.fileExists(docsDirPath)) {
        throw new Error(`Directory "${docsDir}" already exists`);
      }
    }

    // After the guards above, existing is non-null in force mode and null in non-force mode.
    const resolvedDocsDir = force && existing !== null ? existing.docsDir : docsDir;
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

    const manifest = force && existing !== null ? existing : Manifest.create(resolvedDocsDir);
    manifest.addDocs(descriptor.version, generated);
    await this.manifestRepo.save(manifest);
    await writeCatalog(manifest, resolvedDocsDir, projectRoot, this.fs);

    if (!force) {
      await new GitignoreUseCase(this.fs).execute(projectRoot, [".aidd/cache/"]);
    }

    return { docsDir: resolvedDocsDir, fileCount: generated.length, manifest };
  }
}

function remapDocsPath(frameworkRelPath: string, docsDir: string): string {
  if (frameworkRelPath.startsWith(`${FRAMEWORK_DOCS_PREFIX}/`)) {
    return `${docsDir}/${frameworkRelPath.slice(FRAMEWORK_DOCS_PREFIX.length + 1)}`;
  }
  return frameworkRelPath;
}

function rewriteDocsContent(content: string, docsDir: string): string {
  return content.replaceAll("{{DOCS}}/", `${docsDir}/`).replaceAll("{{TOOLS}}/", `${docsDir}/`);
}
