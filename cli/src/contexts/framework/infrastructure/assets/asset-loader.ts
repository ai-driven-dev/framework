import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AssetNotFoundError } from "../../../../kernel/errors.js";
import type { ConfigAsset, SchemaName } from "../../../../kernel/file.js";
import type { AssetProvider } from "../../../../kernel/ports/asset-provider.js";
import type { ToolId } from "../../../../kernel/tool.js";

/** The one thing the loader asks of a tool catalog: a profile that can hand back a shipped config. */
interface ConfigAssetCatalog {
  profile(id: ToolId): {
    configAsset(name: string): { readonly content: ConfigAsset } | undefined;
  };
}

const SCHEMA_FILE = "claude-code-plugin-manifest.json";
const MARKETPLACE_SCHEMA_FILE = "copilot-plugin-marketplace.json";
const CLAUDE_MARKETPLACE_SCHEMA_FILE = "claude-marketplace-manifest.json";
const CODEX_MARKETPLACE_SCHEMA_FILE = "codex-marketplace-manifest.json";
const CODEX_PLUGIN_MANIFEST_SCHEMA_FILE = "codex-plugin-manifest.json";

const SCHEMA_FILES: Record<SchemaName, string> = {
  "plugin-manifest": SCHEMA_FILE,
  marketplace: MARKETPLACE_SCHEMA_FILE,
  "claude-marketplace": CLAUDE_MARKETPLACE_SCHEMA_FILE,
  "codex-marketplace": CODEX_MARKETPLACE_SCHEMA_FILE,
  "codex-plugin-manifest": CODEX_PLUGIN_MANIFEST_SCHEMA_FILE,
};

export class BundledAssetProviderAdapter implements AssetProvider {
  private readonly schemaCache = new Map<SchemaName, object>();

  constructor(private readonly tools: ConfigAssetCatalog) {}

  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset {
    const shipped = this.tools.profile(toolId).configAsset(fileName);
    if (shipped === undefined) {
      throw new AssetNotFoundError(`${toolId}/${fileName}`);
    }
    return shipped.content;
  }

  loadSchema(name: SchemaName): object {
    const cached = this.schemaCache.get(name);
    if (cached !== undefined) return cached;
    const schema = this.readSchemaFileFromDisk(SCHEMA_FILES[name]);
    this.schemaCache.set(name, schema);
    return schema;
  }

  private readSchemaFileFromDisk(fileName: string): object {
    const candidates = [
      new URL(`../../../../../assets/schemas/${fileName}`, import.meta.url),
      new URL(`./${fileName}`, import.meta.url),
    ];
    for (const url of candidates) {
      const p = fileURLToPath(url);
      if (existsSync(p)) {
        return JSON.parse(readFileSync(p, "utf8")) as object;
      }
    }
    throw new AssetNotFoundError(fileName);
  }
}
