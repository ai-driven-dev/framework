import { join } from "node:path";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

const FRAMEWORK_DOCS_PREFIX = "aidd_docs";

export interface InitOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
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
    private readonly hasher: Hasher
  ) {}

  async execute(options: InitOptions): Promise<InitResult> {
    const { frameworkPath, version, docsDir, projectRoot } = options;

    const docsDirPath = join(projectRoot, docsDir);

    const exists = await this.fs.fileExists(docsDirPath);
    if (exists) {
      throw new Error(`Directory "${docsDir}" already exists`);
    }

    const { descriptor, docsFiles } = await this.loader.loadFromDirectory(frameworkPath, version);

    const generated: GeneratedFile[] = [];
    for (const [frameworkRelPath, content] of docsFiles.entries()) {
      const outputRelPath = remapDocsPath(frameworkRelPath, docsDir);
      const outputPath = join(projectRoot, outputRelPath);
      await this.fs.writeFile(outputPath, content);
      const hash = this.hasher.hash(content);
      generated.push(new GeneratedFile({ relativePath: outputRelPath, content, hash }));
    }

    const manifest = Manifest.create(docsDir);
    manifest.addDocs(descriptor.version, generated);
    await this.manifestRepo.save(manifest);

    return {
      docsDir,
      fileCount: generated.length,
      manifest,
    };
  }
}

function remapDocsPath(frameworkRelPath: string, docsDir: string): string {
  if (frameworkRelPath.startsWith(`${FRAMEWORK_DOCS_PREFIX}/`)) {
    return `${docsDir}/${frameworkRelPath.slice(FRAMEWORK_DOCS_PREFIX.length + 1)}`;
  }
  return frameworkRelPath;
}
