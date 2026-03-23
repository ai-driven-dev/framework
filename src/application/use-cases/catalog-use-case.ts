import { join } from "node:path";
import { type CatalogFile, generateCatalogContent } from "../../domain/models/catalog.js";
import { FRAMEWORK_CONFIG_PREFIX, GITKEEP_FILE } from "../../domain/models/framework-descriptor.js";
import { parseFrontmatter } from "../../domain/models/frontmatter.js";
import type { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";

interface CatalogOptions {
  manifest: Manifest;
  docsDir: string;
  projectRoot: string;
}

function isCatalogExcluded(frameworkPath: string): boolean {
  const parts = frameworkPath.split("/");
  return (
    parts.at(-1) === GITKEEP_FILE ||
    parts.some((p) => p.startsWith(".")) ||
    frameworkPath.startsWith(FRAMEWORK_CONFIG_PREFIX)
  );
}

export class CatalogUseCase {
  constructor(private readonly fs: FileSystem) {}

  async execute({ manifest, docsDir, projectRoot }: CatalogOptions): Promise<void> {
    const files = await this.buildCatalogFiles(manifest, projectRoot);
    const content = generateCatalogContent(files, docsDir);
    await this.fs.writeFile(join(projectRoot, docsDir, "CATALOG.md"), content);
  }

  private async buildCatalogFiles(manifest: Manifest, projectRoot: string): Promise<CatalogFile[]> {
    const files: CatalogFile[] = [];

    for (const toolId of manifest.getInstalledToolIds()) {
      for (const tracked of manifest.getToolFiles(toolId)) {
        const frameworkPath = tracked.frameworkPath ?? tracked.relativePath;
        if (isCatalogExcluded(frameworkPath)) continue;
        const frontmatter = await this.readFrontmatter(join(projectRoot, tracked.relativePath));
        files.push({ frameworkPath, installedPath: tracked.relativePath, toolId, frontmatter });
      }
    }

    return files;
  }

  private async readFrontmatter(absPath: string): Promise<Record<string, unknown>> {
    try {
      const content = await this.fs.readFile(absPath);
      return parseFrontmatter(content).frontmatter;
    } catch {
      return {};
    }
  }
}
