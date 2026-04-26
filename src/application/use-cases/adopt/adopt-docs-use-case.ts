import { join } from "node:path";
import { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import { CatalogUseCase } from "../shared/catalog-use-case.js";

interface AdoptDocsOptions {
  manifest: Manifest;
  docsFiles: Map<string, string>;
  docsDir: string;
  projectRoot: string;
  version: string;
}

export interface AdoptDocsResult {
  docsRegistered: number;
}

export class AdoptDocsUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher,
    private readonly logger: Logger
  ) {}

  async execute(options: AdoptDocsOptions): Promise<AdoptDocsResult> {
    const { manifest, docsFiles, docsDir, projectRoot, version } = options;
    const docsAbsDir = join(projectRoot, docsDir);
    let docsRegistered = 0;
    if (await this.fs.fileExists(docsAbsDir)) {
      this.logger.info("Adopting docs...");
      const docsDistribution = this.buildDocsDistribution(docsFiles, docsDir);
      const registeredFiles = await this.matchDistributionToDisk(docsDistribution, projectRoot);
      manifest.addDocs(version, registeredFiles);
      docsRegistered = registeredFiles.length;
    }
    await this.finalizeCatalog(manifest, docsDir, projectRoot, version);
    return { docsRegistered };
  }

  private async finalizeCatalog(
    manifest: Manifest,
    docsDir: string,
    projectRoot: string,
    version: string
  ): Promise<void> {
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });

    const catalogRelPath = `${docsDir}/CATALOG.md`;
    const catalogAbsPath = join(projectRoot, catalogRelPath);
    if (!(await this.fs.fileExists(catalogAbsPath))) return;

    const catalogHash = await this.fs.readFileHash(catalogAbsPath);
    const currentDocsFiles = manifest.getDocsFiles();
    const updatedDocsFiles = currentDocsFiles.map((f) =>
      f.relativePath === catalogRelPath
        ? new InstallationFile({ relativePath: f.relativePath, content: "", hash: catalogHash })
        : new InstallationFile({ relativePath: f.relativePath, content: "", hash: f.hash })
    );
    if (!currentDocsFiles.some((f) => f.relativePath === catalogRelPath)) {
      updatedDocsFiles.push(
        new InstallationFile({ relativePath: catalogRelPath, content: "", hash: catalogHash })
      );
    }
    manifest.addDocs(manifest.getDocsVersion() ?? version, updatedDocsFiles);
  }

  private buildDocsDistribution(
    docsFiles: Map<string, string>,
    docsDir: string
  ): InstallationFile[] {
    const distribution: InstallationFile[] = [];
    for (const [frameworkRelPath, rawContent] of docsFiles.entries()) {
      if (frameworkRelPath.endsWith("CATALOG.md")) continue;
      const relativePath = frameworkRelPath.startsWith("aidd_docs/")
        ? `${docsDir}/${frameworkRelPath.slice("aidd_docs/".length)}`
        : frameworkRelPath;
      const content = rawContent
        .replaceAll("{{DOCS}}/", `${docsDir}/`)
        .replaceAll("{{TOOLS}}/", `${docsDir}/`);
      const hash = this.hasher.hash(content);
      distribution.push(new InstallationFile({ relativePath, content, hash }));
    }
    return distribution;
  }

  private async matchDistributionToDisk(
    distribution: InstallationFile[],
    projectRoot: string
  ): Promise<InstallationFile[]> {
    const result: InstallationFile[] = [];
    for (const distFile of distribution) {
      const absolutePath = join(projectRoot, distFile.relativePath);
      if (!(await this.fs.fileExists(absolutePath))) continue;
      const hash = await this.fs.readFileHash(absolutePath);
      result.push(
        new InstallationFile({
          relativePath: distFile.relativePath,
          content: "",
          hash,
          frameworkPath: distFile.frameworkPath,
        })
      );
    }
    return result;
  }
}
