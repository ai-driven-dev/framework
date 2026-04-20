import { describe, expect, it } from "vitest";
import { filterGeneratedFilesByIdeContext } from "../../../src/domain/models/config-ref-filter.js";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import type { ConfigRef } from "../../../src/domain/models/framework-descriptor.js";
import { GeneratedFile } from "../../../src/domain/models/generated-file.js";
import type { IdeToolId } from "../../../src/domain/models/tool-config.js";

const DUMMY_HASH = "d41d8cd98f00b204e9800998ecf8427e";

function makeFile(frameworkPath: string): GeneratedFile {
  return new GeneratedFile({
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

describe("filterGeneratedFilesByIdeContext", () => {
  it("includes file with no requiredIdeId regardless of empty ideContext", () => {
    const file = makeFile("config/mcp.json");
    const ref = makeRef("config/mcp.json");
    const result = filterGeneratedFilesByIdeContext([file], [ref], []);
    expect(result).toContain(file);
  });

  it("excludes IDE-conditional file when ideContext is empty", () => {
    const file = makeFile("config/.vscode/copilot-settings.json");
    const ref = makeRef("config/.vscode/copilot-settings.json", "vscode");
    const result = filterGeneratedFilesByIdeContext([file], [ref], []);
    expect(result).not.toContain(file);
  });

  it("includes IDE-conditional file when matching IDE is in ideContext", () => {
    const file = makeFile("config/.vscode/copilot-settings.json");
    const ref = makeRef("config/.vscode/copilot-settings.json", "vscode");
    const result = filterGeneratedFilesByIdeContext([file], [ref], ["vscode"]);
    expect(result).toContain(file);
  });

  it("passes non-conditional files regardless of ideContext and filters conditional ones", () => {
    const regular = makeFile("config/mcp.json");
    const conditional = makeFile("config/.vscode/copilot-settings.json");
    const refs = [
      makeRef("config/mcp.json"),
      makeRef("config/.vscode/copilot-settings.json", "vscode"),
    ];
    const result = filterGeneratedFilesByIdeContext([regular, conditional], refs, []);
    expect(result).toContain(regular);
    expect(result).not.toContain(conditional);
  });
});
