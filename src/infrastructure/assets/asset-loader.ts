import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import claudeSettings from "../../../assets/configs/claude/settings.json" with { type: "json" };
import codexConfigToml from "../../../assets/configs/codex/config.toml";
import copilotVscodeSettings from "../../../assets/configs/copilot/vscode-settings.json" with {
  type: "json",
};
import cursorSettings from "../../../assets/configs/cursor/settings.json" with { type: "json" };
import opencodeJson from "../../../assets/configs/opencode/opencode.json" with { type: "json" };
import vscodeExtensions from "../../../assets/configs/vscode/extensions.json" with { type: "json" };
import vscodeKeybindings from "../../../assets/configs/vscode/keybindings.json" with {
  type: "json",
};
import vscodeSettings from "../../../assets/configs/vscode/settings.json" with { type: "json" };
import defaultMarketplaceJson from "../../../assets/marketplaces/default.json" with {
  type: "json",
};
import type { ToolId } from "../../domain/models/tool-ids.js";
import type {
  AssetProvider,
  ConfigAsset,
  DefaultMarketplace,
} from "../../domain/ports/asset-provider.js";

const SCHEMA_FILE = "claude-code-plugin-manifest.json";
const MARKETPLACE_SCHEMA_FILE = "copilot-plugin-marketplace.json";
const CLAUDE_MARKETPLACE_SCHEMA_FILE = "claude-marketplace-manifest.json";
const CODEX_PLUGIN_MANIFEST_SCHEMA_FILE = "codex-plugin-manifest.json";

const CONFIG_ASSETS: Readonly<Record<ToolId, Readonly<Record<string, ConfigAsset>>>> = {
  claude: { "settings.json": claudeSettings },
  cursor: { "settings.json": cursorSettings },
  copilot: { "vscode-settings.json": copilotVscodeSettings },
  opencode: { "opencode.json": opencodeJson },
  codex: { "config.toml": codexConfigToml },
  vscode: {
    "settings.json": vscodeSettings,
    "keybindings.json": vscodeKeybindings,
    "extensions.json": vscodeExtensions,
  },
};

export class BundledAssetProviderAdapter implements AssetProvider {
  private cachedSchema: object | undefined;
  private cachedMarketplaceSchema: object | undefined;
  private cachedClaudeMarketplaceSchema: object | undefined;
  private cachedCodexPluginManifestSchema: object | undefined;

  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset {
    const asset = CONFIG_ASSETS[toolId][fileName];
    if (asset === undefined) {
      throw new Error(`No config asset for tool '${toolId}' with file '${fileName}'`);
    }
    return asset;
  }

  loadDefaultMarketplace(): DefaultMarketplace {
    return defaultMarketplaceJson as DefaultMarketplace;
  }

  loadPluginManifestSchema(): object {
    if (this.cachedSchema !== undefined) return this.cachedSchema;
    this.cachedSchema = this.readSchemaFileFromDisk(SCHEMA_FILE);
    return this.cachedSchema;
  }

  loadMarketplaceSchema(): object {
    if (this.cachedMarketplaceSchema !== undefined) return this.cachedMarketplaceSchema;
    this.cachedMarketplaceSchema = this.readSchemaFileFromDisk(MARKETPLACE_SCHEMA_FILE);
    return this.cachedMarketplaceSchema;
  }

  loadClaudeMarketplaceSchema(): object {
    if (this.cachedClaudeMarketplaceSchema !== undefined) return this.cachedClaudeMarketplaceSchema;
    this.cachedClaudeMarketplaceSchema = this.readSchemaFileFromDisk(
      CLAUDE_MARKETPLACE_SCHEMA_FILE
    );
    return this.cachedClaudeMarketplaceSchema;
  }

  loadCodexPluginManifestSchema(): object {
    if (this.cachedCodexPluginManifestSchema !== undefined) {
      return this.cachedCodexPluginManifestSchema;
    }
    this.cachedCodexPluginManifestSchema = this.readSchemaFileFromDisk(
      CODEX_PLUGIN_MANIFEST_SCHEMA_FILE
    );
    return this.cachedCodexPluginManifestSchema;
  }

  private readSchemaFileFromDisk(fileName: string): object {
    const candidates = [
      new URL(`../../../assets/schemas/${fileName}`, import.meta.url),
      new URL(`./${fileName}`, import.meta.url),
    ];
    for (const url of candidates) {
      const p = fileURLToPath(url);
      if (existsSync(p)) {
        return JSON.parse(readFileSync(p, "utf8")) as object;
      }
    }
    throw new Error(`Schema file '${fileName}' not found.`);
  }
}
