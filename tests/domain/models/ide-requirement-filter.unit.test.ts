import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { GeneratedFile } from "../../../src/domain/models/generated-file.js";
import { filterByIdeRequirements } from "../../../src/domain/models/ide-requirement-filter.js";
// Side-effect import: registers vscode in the tool registry so filterByIdeRequirements can resolve its directory
import "../../../src/domain/tools/ide/vscode.js";

const DUMMY_HASH = "d41d8cd98f00b204e9800998ecf8427e";

function makeFile(relativePath: string, frameworkPath: string): GeneratedFile {
  return new GeneratedFile({
    relativePath,
    content: "{}",
    hash: new FileHash(DUMMY_HASH),
    mergeStrategy: "none",
    frameworkPath,
  });
}

describe("filterByIdeRequirements", () => {
  describe("configRef-based filtering", () => {
    it("keeps files when their required IDE is installed", () => {
      const files = [makeFile(".vscode/settings.json", "config/vscode/settings.json")];
      const refs = [
        {
          name: "vscode-settings",
          path: "config/vscode/settings.json",
          requiredIdeId: "vscode" as const,
        },
      ];

      const result = filterByIdeRequirements(files, refs, ["vscode"]);

      expect(result).toHaveLength(1);
    });

    it("removes files when their required IDE is not installed", () => {
      const files = [makeFile(".vscode/settings.json", "config/vscode/settings.json")];
      const refs = [
        {
          name: "vscode-settings",
          path: "config/vscode/settings.json",
          requiredIdeId: "vscode" as const,
        },
      ];

      const result = filterByIdeRequirements(files, refs, []);

      expect(result).toHaveLength(0);
    });
  });

  describe("output-path-based filtering", () => {
    it("keeps files outside any IDE directory regardless of installed IDEs", () => {
      const files = [makeFile("opencode.json", "config/mcp.json")];

      const result = filterByIdeRequirements(files, [], []);

      expect(result).toHaveLength(1);
    });

    it("removes files under .vscode/ when vscode is not installed", () => {
      const files = [makeFile(".vscode/mcp.json", "config/mcp.json")];

      const result = filterByIdeRequirements(files, [], []);

      expect(result).toHaveLength(0);
    });

    it("keeps files under .vscode/ when vscode is installed", () => {
      const files = [makeFile(".vscode/mcp.json", "config/mcp.json")];

      const result = filterByIdeRequirements(files, [], ["vscode"]);

      expect(result).toHaveLength(1);
    });
  });
});
