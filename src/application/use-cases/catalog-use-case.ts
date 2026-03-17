import { join } from "node:path";
import { generateCatalogContent } from "../../domain/models/catalog.js";
import type { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";

interface CatalogOptions {
  manifest: Manifest;
  docsDir: string;
  projectRoot: string;
}

export class CatalogUseCase {
  constructor(private readonly fs: FileSystem) {}

  async execute({ manifest, docsDir, projectRoot }: CatalogOptions): Promise<void> {
    const content = generateCatalogContent(manifest, docsDir);
    await this.fs.writeFile(join(projectRoot, docsDir, "CATALOG.md"), content);
  }
}
