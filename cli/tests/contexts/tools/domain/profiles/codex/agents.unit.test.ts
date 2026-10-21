import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex agents", () => {
  describe("capabilities.agents.params.userDirectory()", () => {
    it("follows CODEX_HOME, else ~/.codex", () => {
      const userDirectory = codex.capabilities.agents.params.userDirectory;
      expect(userDirectory?.("/home", (name) => (name === "CODEX_HOME" ? "/cx" : undefined))).toBe(
        "/cx"
      );
      expect(userDirectory?.("/home", () => undefined)).toBe(join("/home", ".codex"));
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds .toml path under .codex/agents/", () => {
      const path = codex.capabilities.agents.buildInstallPath("alexia.md");
      expect(path).toBe(".codex/agents/alexia.toml");
    });
  });
});
