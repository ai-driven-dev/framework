import { describe, expect, it } from "vitest";
import { filterByIdeRequirements } from "../../../src/application/use-cases/shared/ide-requirement-filter.js";
import { FileHash, InstallationFile } from "../../../src/domain/models/file.js";
import type { ConfigRef } from "../../../src/domain/models/framework.js";
import type { IdeToolId } from "../../../src/domain/tools/registry.js";
// Side-effect import: registers vscode in the tool registry so filterByIdeRequirements can resolve its directory
import "../../../src/domain/tools/ide/vscode.js";

const DUMMY_HASH = "d41d8cd98f00b204e9800998ecf8427e";

function makeFile(frameworkPath: string): InstallationFile {
  return new InstallationFile({
    relativePath: frameworkPath.replace("config/", ""),
    content: "{}",
    hash: new FileHash(DUMMY_HASH),
    mergeStrategy: "none",
    frameworkPath,
  });
}

function makeRef(path: string, requiredIdeId?: IdeToolId): ConfigRef {
  return requiredIdeId !== undefined ? { name: path, path, requiredIdeId } : { name: path, path };
}

describe("filterByIdeRequirements", () => {
  it("includes file with no requiredIdeId regardless of empty ideContext", () => {
    const file = makeFile("config/mcp.json");
    const ref = makeRef("config/mcp.json");
    const result = filterByIdeRequirements([file], [ref], []);
    expect(result).toContain(file);
  });

  it("excludes IDE-conditional file when ideContext is empty", () => {
    const file = makeFile("config/copilot/settings.json");
    const ref = makeRef("config/copilot/settings.json", "vscode");
    const result = filterByIdeRequirements([file], [ref], []);
    expect(result).not.toContain(file);
  });

  it("includes IDE-conditional file when matching IDE is in ideContext", () => {
    const file = makeFile("config/copilot/settings.json");
    const ref = makeRef("config/copilot/settings.json", "vscode");
    const result = filterByIdeRequirements([file], [ref], ["vscode"]);
    expect(result).toContain(file);
  });

  it("passes non-conditional files regardless of ideContext and filters conditional ones", () => {
    const regular = makeFile("config/mcp.json");
    const conditional = makeFile("config/copilot/settings.json");
    const refs = [makeRef("config/mcp.json"), makeRef("config/copilot/settings.json", "vscode")];
    const result = filterByIdeRequirements([regular, conditional], refs, []);
    expect(result).toContain(regular);
    expect(result).not.toContain(conditional);
  });
});
