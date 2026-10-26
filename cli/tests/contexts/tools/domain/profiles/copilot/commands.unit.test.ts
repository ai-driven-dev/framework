import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot commands", () => {
  describe("capabilities.commands.buildInstallPath()", () => {
    it("flattens commands: prefixes with phase number", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("04_code/implement.md");
      expect(path).toBe(".github/prompts/04-implement.prompt.md");
    });

    it("flattens commands: converts underscores to hyphens in filename", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("00_behavior/auto_accept.md");
      expect(path).toBe(".github/prompts/00-auto-accept.prompt.md");
    });

    it("handles top-level commands file without subdirectory", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("commit.md");
      expect(path).toBe(".github/prompts/commit.prompt.md");
    });

    it("prefixes a command nested two folders deep with both folders' phase numbers", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("01_plan/02_steps/review.md");
      expect(path).toBe(".github/prompts/01-02-review.prompt.md");
    });

    it("keeps a folder name whole when it does not start with a phase number", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("v2-tools/x.md");
      expect(path).toBe(".github/prompts/v2-tools-x.prompt.md");
    });

    it("does not add the prompt extension twice to a file that already carries it", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("review.prompt.md");
      expect(path).toBe(".github/prompts/review.prompt.md");
    });

    it("adds the prompt extension to a file that carries no extension at all", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("commit");
      expect(path).toBe(".github/prompts/commit.prompt.md");
    });
  });
});
