import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { getToolConfig } from "../../../../../../src/contexts/tools/domain/registry.js";

describe("codex profile", () => {
  it("has toolId codex", () => {
    expect(codex.toolId).toBe("codex");
  });

  it("has .codex/ directory", () => {
    expect(codex.directory).toBe(".codex/");
  });

  it("has .codex.md tool suffix", () => {
    expect(codex.toolSuffix).toBe(".codex.md");
  });

  it("has signalDir pointing at .codex/commands", () => {
    expect(codex.signalDir).toBe(".codex/commands");
  });

  it("is registered in the tool registry", () => {
    const config = getToolConfig("codex");
    expect(config.toolId).toBe("codex");
  });

  it("names the one config file Codex reads, and where it goes", () => {
    expect(codex.configOutputPaths).toStrictEqual({ "config.toml": ".codex/config.toml" });
  });
});
