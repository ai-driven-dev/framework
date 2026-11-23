import { describe, expect, it } from "vitest";
import { codexSpec } from "../../../../../../src/composition/tool-profiles/codex.js";
import { defineAiTool } from "../../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { SmolTomlCodec } from "../../../../../../src/shared/infrastructure/smol-toml-codec.adapter.js";

const TOML = new SmolTomlCodec();
const codex = defineAiTool(codexSpec, { toml: TOML });

describe("codex mcp", () => {
  describe("with Codex's mcp capability", () => {
    it("outputs to .codex/config.toml", () => {
      expect(codex.section("mcp").config?.accepts(".codex/config.toml")).toBe(true);
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.section("mcp").config?.fileOf("{}").mergeStrategy).toBe("user-prime");
    });

    it("writes its config in TOML", () => {
      const written = codex
        .section("mcp")
        .config?.transform(JSON.stringify({ mcpServers: { a: { command: "node" } } }));
      expect(() => JSON.parse(written)).toThrow();
      expect(written).toContain("mcp_servers.a");
    });
  });
});
