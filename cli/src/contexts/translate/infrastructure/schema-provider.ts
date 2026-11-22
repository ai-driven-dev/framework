import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SchemaName } from "../../../shared/domain/reading/config-asset.js";
import { AssetNotFoundError } from "../../../shared/domain/shared.error.js";
import type { SchemaProvider } from "../ports/schema-provider.js";

const SCHEMA_FILES: Record<SchemaName, string> = {
  "plugin-manifest": "claude-code-plugin-manifest.json",
  marketplace: "copilot-plugin-marketplace.json",
  "claude-marketplace": "claude-marketplace-manifest.json",
  "codex-marketplace": "codex-marketplace-manifest.json",
  "codex-plugin-manifest": "codex-plugin-manifest.json",
};

export class BundledSchemaProviderAdapter implements SchemaProvider {
  private readonly cache = new Map<SchemaName, object>();

  loadSchema(name: SchemaName): object {
    const cached = this.cache.get(name);
    if (cached !== undefined) return cached;
    const schema = this.readFromDisk(SCHEMA_FILES[name]);
    this.cache.set(name, schema);
    return schema;
  }

  private readFromDisk(fileName: string): object {
    const candidates = [
      new URL(`../../../../assets/schemas/${fileName}`, import.meta.url),
      new URL(`./${fileName}`, import.meta.url),
    ];
    for (const url of candidates) {
      const p = fileURLToPath(url);
      if (existsSync(p)) {
        const schema: unknown = JSON.parse(readFileSync(p, "utf8"));
        if (typeof schema === "object" && schema !== null) return schema;
      }
    }
    throw new AssetNotFoundError(fileName);
  }
}
