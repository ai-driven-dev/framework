import { isAbsolute, join, resolve } from "node:path";
import { InvalidPluginManifestError } from "../../domain/errors.js";
import { parseCodexMarketplace } from "../../domain/formats/codex-marketplace.js";
import { parseCopilotMarketplace } from "../../domain/formats/copilot-marketplace.js";
import { parseCursorMarketplace } from "../../domain/formats/cursor-marketplace.js";
import { parseOpencodeMarketplace } from "../../domain/formats/opencode-marketplace.js";
import type { NormalizedPlugin } from "../../domain/models/normalized-plugin.js";
import { type PluginCatalog, parsePluginCatalog } from "../../domain/models/plugin-catalog.js";
import { MARKETPLACE_PROBES } from "../../domain/models/plugin-format.js";
import type { PluginSource } from "../../domain/models/plugin-source.js";
import type { FileReader } from "../../domain/ports/file-reader.js";
import type { PluginCatalogRepository } from "../../domain/ports/plugin-catalog-repository.js";

const CLAUDE_MARKETPLACE_PATH = ".claude-plugin/marketplace.json";

export class PluginCatalogRepositoryAdapter implements PluginCatalogRepository {
  constructor(private readonly fs: FileReader) {}

  async load(frameworkPath: string): Promise<PluginCatalog | null> {
    const fullPath = join(frameworkPath, CLAUDE_MARKETPLACE_PATH);
    if (!(await this.fs.fileExists(fullPath))) {
      return null;
    }
    const catalog = await this.readClaudeCatalog(fullPath);
    return this.resolveLocalPaths(catalog, frameworkPath);
  }

  async loadForeign(frameworkPath: string): Promise<NormalizedPlugin[]> {
    for (const probe of MARKETPLACE_PROBES) {
      if (probe.format === "claude") continue;
      const fullPath = join(frameworkPath, probe.relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      if (probe.format === "cursor") return this.readCursorCatalog(fullPath);
      if (probe.format === "codex") return this.readCodexCatalog(fullPath);
      if (probe.format === "copilot") return this.readCopilotCatalog(fullPath);
      if (probe.format === "opencode") return this.readOpencodeCatalog(fullPath);
    }
    return [];
  }

  private async readClaudeCatalog(fullPath: string): Promise<PluginCatalog> {
    let raw: unknown;
    try {
      raw = JSON.parse(await this.fs.readFile(fullPath));
    } catch {
      throw new InvalidPluginManifestError(`marketplace.json at "${fullPath}" is not valid JSON`);
    }
    try {
      return parsePluginCatalog(raw);
    } catch (err) {
      if (err instanceof InvalidPluginManifestError) throw err;
      throw new InvalidPluginManifestError(
        `marketplace.json at "${fullPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async readCursorCatalog(fullPath: string): Promise<NormalizedPlugin[]> {
    const raw = await this.fs.readFile(fullPath);
    return [...parseCursorMarketplace(raw).plugins];
  }

  private async readCodexCatalog(fullPath: string): Promise<NormalizedPlugin[]> {
    const raw = await this.fs.readFile(fullPath);
    return [...parseCodexMarketplace(raw).plugins];
  }

  private async readCopilotCatalog(fullPath: string): Promise<NormalizedPlugin[]> {
    const raw = await this.fs.readFile(fullPath);
    return [...parseCopilotMarketplace(raw).plugins];
  }

  private async readOpencodeCatalog(fullPath: string): Promise<NormalizedPlugin[]> {
    const raw = await this.fs.readFile(fullPath);
    return [...parseOpencodeMarketplace(raw).plugins];
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
