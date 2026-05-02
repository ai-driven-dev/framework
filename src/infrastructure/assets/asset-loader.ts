import claudeSettings from "../../../assets/configs/claude/settings.json" with { type: "json" };
import codexConfigToml from "../../../assets/configs/codex/config.toml";
import copilotSettings from "../../../assets/configs/copilot/settings.json" with { type: "json" };
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
import agentsStub from "../../../assets/memory-stubs/AGENTS.md";
import claudeStub from "../../../assets/memory-stubs/CLAUDE.md";
import copilotStub from "../../../assets/memory-stubs/copilot-instructions.md";
import type { AiToolId, ToolId } from "../../domain/models/tool-ids.js";
import type {
  AssetProvider,
  ConfigAsset,
  DefaultMarketplace,
  MemoryStub,
} from "../../domain/ports/asset-provider.js";

const CONFIG_ASSETS: Readonly<Record<ToolId, Readonly<Record<string, ConfigAsset>>>> = {
  claude: { "settings.json": claudeSettings },
  cursor: { "settings.json": cursorSettings },
  copilot: { "settings.json": copilotSettings },
  opencode: { "opencode.json": opencodeJson },
  codex: { "config.toml": codexConfigToml },
  vscode: {
    "settings.json": vscodeSettings,
    "keybindings.json": vscodeKeybindings,
    "extensions.json": vscodeExtensions,
  },
};

const MEMORY_STUBS: Readonly<Record<AiToolId, MemoryStub>> = {
  claude: { fileName: "CLAUDE.md", content: claudeStub },
  cursor: { fileName: "AGENTS.md", content: agentsStub },
  copilot: { fileName: ".github/copilot-instructions.md", content: copilotStub },
  opencode: { fileName: "AGENTS.md", content: agentsStub },
  codex: { fileName: "AGENTS.md", content: agentsStub },
};

export class BundledAssetProviderAdapter implements AssetProvider {
  loadConfigAsset(toolId: ToolId, fileName: string): ConfigAsset {
    const asset = CONFIG_ASSETS[toolId][fileName];
    if (asset === undefined) {
      throw new Error(`No config asset for tool '${toolId}' with file '${fileName}'`);
    }
    return asset;
  }

  loadMemoryStub(toolId: AiToolId): MemoryStub {
    return MEMORY_STUBS[toolId];
  }

  loadDefaultMarketplace(): DefaultMarketplace {
    return defaultMarketplaceJson as DefaultMarketplace;
  }
}
