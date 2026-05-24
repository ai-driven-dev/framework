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
    this.cachedSchema = this.readSchemaFromDisk();
    return this.cachedSchema;
  }

  private readSchemaFromDisk(): object {
    const candidates = [
      new URL(`../../../assets/schemas/${SCHEMA_FILE}`, import.meta.url),
      new URL(`./${SCHEMA_FILE}`, import.meta.url),
    ];
    for (const url of candidates) {
      const p = fileURLToPath(url);
      if (existsSync(p)) {
        return JSON.parse(readFileSync(p, "utf8")) as object;
      }
    }
    throw new Error(`Plugin manifest schema not found.`);
  }
}
