import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";
import { wireTools } from "../../../src/composition/tools.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const { vscode } = TOOL;

const provider = new BundledAssetProviderAdapter(wireTools());

describe("BundledAssetProviderAdapter.loadConfigAsset, per registered tool", () => {
  describe("for the claude config assets", () => {
    it("returns parsed settings.json with permissions", () => {
      const asset = provider.loadConfigAsset(TOOL.claude, "settings.json");
      expect(asset).toHaveProperty("permissions");
    });
  });

  describe("for the opencode config assets", () => {
    it("bundles the shared event adapter as executable source text", () => {
      const asset = provider.loadConfigAsset(TOOL.opencode, "opencode-events.js");

      expect(typeof asset).toBe("string");
      expect(asset).toContain("export async function setupOpencodeEvents");
    });

    it("returns parsed opencode.json with instructions array", () => {
      const asset = provider.loadConfigAsset(TOOL.opencode, "opencode.json");
      expect(asset).toHaveProperty("instructions");
    });
  });

  describe("for the kilo config assets", () => {
    it("returns parsed kilo.json with its schema", () => {
      const asset = provider.loadConfigAsset(TOOL.kilo, "kilo.json");
      expect(asset).toMatchObject({
        $schema: "https://app.kilo.ai/config.json",
      });
      expect(asset).not.toHaveProperty("instructions");
    });
  });

  describe("for the codex config assets", () => {
    it("returns config.toml as raw string", () => {
      const asset = provider.loadConfigAsset(TOOL.codex, "config.toml");
      expect(typeof asset).toBe("string");
    });

    // Model choice is owned by the account, not this repo: a pinned "gpt-5" is rejected by
    // ChatGPT-account Codex sessions, so Codex's own default applies.
    it("writes no model - the account decides which one it can use", () => {
      const asset = provider.loadConfigAsset(TOOL.codex, "config.toml");
      const parsed = parseToml(String(asset));
      expect(parsed).not.toHaveProperty("model");
    });
  });

  describe("for the copilot config assets", () => {
    it("returns merged vscode-settings.json with ≥26 keys including both asset origins", () => {
      const asset = provider.loadConfigAsset(TOOL.copilot, "vscode-settings.json");
      expect(Object.keys(asset).length).toBeGreaterThanOrEqual(26);
      expect(asset).toHaveProperty("chat.plugins.enabled", true);
      expect(asset).toHaveProperty("chat.useAgentSkills", true);
      expect(asset).toHaveProperty("chat.tools.urls.autoApprove");
      expect(asset).toHaveProperty("github.copilot.chat.agent.autoFix", true);
    });
  });

  describe("for the vscode config assets", () => {
    it("returns settings.json as object", () => {
      const asset = provider.loadConfigAsset(vscode, "settings.json");
      expect(asset).toHaveProperty("editor.formatOnSave");
    });

    it("returns keybindings.json as array", () => {
      const asset = provider.loadConfigAsset(vscode, "keybindings.json");
      expect(Array.isArray(asset)).toBe(true);
    });

    it("returns extensions.json with recommendations", () => {
      const asset = provider.loadConfigAsset(vscode, "extensions.json");
      expect(asset).toHaveProperty("recommendations");
    });
  });
});
