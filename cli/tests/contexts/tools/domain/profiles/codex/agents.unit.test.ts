import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex agents", () => {
  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds .toml path under .codex/agents/", () => {
      const path = codex.capabilities.agents.buildInstallPath("alexia.md");
      expect(path).toBe(".codex/agents/alexia.toml");
    });
  });
});
