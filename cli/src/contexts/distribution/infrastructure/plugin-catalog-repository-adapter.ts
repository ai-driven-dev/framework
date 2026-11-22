import { isAbsolute, join, resolve } from "node:path";
import { errorMessage } from "../../../shared/domain/describe-error.js";
import { InvalidPluginManifestError } from "../../../shared/domain/shared.error.js";
import type { PluginSource } from "../../../shared/domain/source.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { PluginCatalog } from "../contract/catalog.js";
import { parsePluginCatalog } from "../domain/catalog-parsers/claude-marketplace-catalog.js";
import { parseCopilotMarketplaceCatalog } from "../domain/catalog-parsers/copilot-marketplace-catalog.js";
import { MalformedMarketplaceCatalogError } from "../domain/distribution.error.js";
import { CATALOG_LOCATIONS, MARKETPLACE_CACHE_SUBDIR } from "../domain/marketplace-cache-layout.js";
import type { PluginCatalogRepository } from "../ports/plugin-catalog-repository.js";

export class PluginCatalogRepositoryAdapter implements PluginCatalogRepository {
  constructor(private readonly fs: FileReader) {}

  async load(frameworkPath: string): Promise<PluginCatalog | null> {
    for (const { format, relative } of CATALOG_LOCATIONS) {
      const path = join(frameworkPath, relative);
      if (!(await this.fs.fileExists(path))) continue;
      const catalog =
        format === "plugin-root"
          ? await this.readCopilotNativeCatalog(path)
          : await this.readClaudeCatalog(path);
      return this.resolveLocalPaths(catalog, frameworkPath);
    }
    return null;
  }

  private isCachePath(fullPath: string): boolean {
    return fullPath.includes(MARKETPLACE_CACHE_SUBDIR);
  }

  private parseDetail(err: unknown): string {
    if (err instanceof InvalidPluginManifestError) return err.detail ?? "";
    return errorMessage(err);
  }

  private async readCopilotNativeCatalog(fullPath: string): Promise<PluginCatalog> {
    const raw = await this.fs.readFile(fullPath);
    try {
      return parseCopilotMarketplaceCatalog(raw);
    } catch (err) {
      throw new MalformedMarketplaceCatalogError(
        fullPath,
        this.parseDetail(err),
        this.isCachePath(fullPath)
      );
    }
  }

  private async readClaudeCatalog(fullPath: string): Promise<PluginCatalog> {
    const cached = this.isCachePath(fullPath);
    let raw: unknown;
    try {
      raw = JSON.parse(await this.fs.readFile(fullPath));
    } catch {
      throw new MalformedMarketplaceCatalogError(fullPath, "not valid JSON", cached);
    }
    try {
      return parsePluginCatalog(raw);
    } catch (err) {
      throw new MalformedMarketplaceCatalogError(fullPath, this.parseDetail(err), cached);
    }
  }

  private resolveLocalPaths(catalog: PluginCatalog, frameworkPath: string): PluginCatalog {
    const plugins = catalog.plugins.map((entry) => ({
      ...entry,
      source: this.resolveSource(entry.source, frameworkPath),
    }));
    const resolved: PluginCatalog = { plugins };
    if (catalog.name !== undefined) resolved.name = catalog.name;
    if (catalog.version !== undefined) resolved.version = catalog.version;
    return resolved;
  }

  private resolveSource(source: PluginSource, frameworkPath: string): PluginSource {
    if (source.kind !== "local") return source;
    if (isAbsolute(source.path)) return source;
    return { kind: "local", path: resolve(frameworkPath, source.path) };
  }
}
