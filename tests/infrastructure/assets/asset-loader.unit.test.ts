import { describe, expect, it } from "vitest";
import { BundledAssetProviderAdapter } from "../../../src/infrastructure/assets/asset-loader.js";

const provider = new BundledAssetProviderAdapter();

describe("BundledAssetProviderAdapter.loadConfigAsset", () => {
  describe("claude", () => {
    it("returns parsed settings.json with permissions", () => {
      const asset = provider.loadConfigAsset("claude", "settings.json") as Record<string, unknown>;
      expect(asset).toHaveProperty("permissions");
    });
  });

  describe("opencode", () => {
    it("returns parsed opencode.json with instructions array", () => {
      const asset = provider.loadConfigAsset("opencode", "opencode.json") as Record<
        string,
        unknown
      >;
      expect(asset).toHaveProperty("instructions");
    });
  });

  describe("codex", () => {
    it("returns config.toml as raw string", () => {
      const asset = provider.loadConfigAsset("codex", "config.toml");
      expect(typeof asset).toBe("string");
      expect(asset as string).toContain("model");
    });
  });

  describe("vscode", () => {
    it("returns settings.json as object", () => {
      const asset = provider.loadConfigAsset("vscode", "settings.json") as Record<string, unknown>;
      expect(asset).toHaveProperty("editor.formatOnSave");
    });

    it("returns keybindings.json as array", () => {
      const asset = provider.loadConfigAsset("vscode", "keybindings.json");
      expect(Array.isArray(asset)).toBe(true);
    });

    it("returns extensions.json with recommendations", () => {
      const asset = provider.loadConfigAsset("vscode", "extensions.json") as Record<
        string,
        unknown
      >;
      expect(asset).toHaveProperty("recommendations");
    });
  });

  it("throws for an unknown file name", () => {
    expect(() => provider.loadConfigAsset("claude", "missing.json")).toThrow(
      "No config asset for tool 'claude' with file 'missing.json'"
    );
  });
});

describe("BundledAssetProviderAdapter.loadMemoryStub", () => {
  it("maps claude to CLAUDE.md", () => {
    const stub = provider.loadMemoryStub("claude");
    expect(stub.fileName).toBe("CLAUDE.md");
    expect(stub.content).toContain("aidd_docs/memory/");
  });

  it("maps cursor to AGENTS.md", () => {
    expect(provider.loadMemoryStub("cursor").fileName).toBe("AGENTS.md");
  });

  it("maps copilot to .github/copilot-instructions.md", () => {
    expect(provider.loadMemoryStub("copilot").fileName).toBe(".github/copilot-instructions.md");
  });

  it("maps opencode to AGENTS.md", () => {
    expect(provider.loadMemoryStub("opencode").fileName).toBe("AGENTS.md");
  });

  it("maps codex to AGENTS.md", () => {
    expect(provider.loadMemoryStub("codex").fileName).toBe("AGENTS.md");
  });

  it("hardcodes aidd_docs (no placeholders)", () => {
    expect(provider.loadMemoryStub("claude").content).not.toContain("{{DOCS}}");
    expect(provider.loadMemoryStub("claude").content).not.toContain("{{TOOLS}}");
  });
});

describe("BundledAssetProviderAdapter.loadDefaultMarketplace", () => {
  it("returns the aidd-framework Git source", () => {
    const marketplace = provider.loadDefaultMarketplace();
    expect(marketplace.name).toBe("aidd-framework");
    expect(marketplace.type).toBe("git");
    expect(marketplace.source).toMatch(/^https:\/\/github\.com\/.+\.git$/);
  });
});
