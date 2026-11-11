import { describe, expect, it } from "vitest";
import { AssetNotFoundError } from "../../../src/kernel/errors.js";
import type { ToolId } from "../../../src/kernel/tool.js";
import { BundledAssetProviderAdapter } from "../../../src/runtime/assets/asset-loader.js";

const EXPECTED_ASSETS: Readonly<Record<ToolId, readonly string[]>> = {
  antigravity: [],
  claude: ["settings.json"],
  codex: ["config.toml"],
  copilot: ["vscode-settings.json"],
  cursor: ["settings.json"],
  kilo: ["kilo.json"],
  opencode: ["opencode-events.js", "opencode.json"],
  vscode: ["extensions.json", "keybindings.json", "settings.json"],
};

const EVERY_NAME = [...new Set(Object.values(EXPECTED_ASSETS).flat())];
const provider = new BundledAssetProviderAdapter();

describe("BundledAssetProviderAdapter config assets per tool", () => {
  it.each(Object.entries(EXPECTED_ASSETS) as [ToolId, readonly string[]][])(
    "yields exactly its own config assets for %s",
    (toolId, own) => {
      for (const name of EVERY_NAME) {
        const load = () => provider.loadConfigAsset(toolId, name);
        if (own.includes(name)) expect(load).not.toThrow();
        else expect(load).toThrow(AssetNotFoundError);
      }
    }
  );
});
