import { describe, expect, it } from "vitest";
import {
  FlatMergeTargetNotJsonError,
  FlatTargetExistsError,
  FrameworkPlaceholderInPluginError,
  InvalidBuildPathsError,
  JsonSchemaValidationError,
  MarketplaceOutDirNotEmptyError,
  OutDirNotDirectoryError,
} from "../../../../src/contexts/translate/contract/translate.error.js";

describe("when FlatMergeTargetNotJsonError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new FlatMergeTargetNotJsonError("f.json", "Unexpected token");
    expect({
      name: error.name,
      shownPath: error.shownPath,
      parseMessage: error.parseMessage,
      message: error.message,
    }).toStrictEqual({
      name: "FlatMergeTargetNotJsonError",
      shownPath: "f.json",
      parseMessage: "Unexpected token",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new FlatMergeTargetNotJsonError("f.json", "Unexpected token").code).toBe(
      "flat-merge-target-not-json"
    );
  });
});

describe("when FlatTargetExistsError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new FlatTargetExistsError("/out/a.md", "aidd-dev");
    expect({
      name: error.name,
      targetPath: error.targetPath,
      pluginName: error.pluginName,
      message: error.message,
    }).toStrictEqual({
      name: "FlatTargetExistsError",
      targetPath: "/out/a.md",
      pluginName: "aidd-dev",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new FlatTargetExistsError("/out/a.md", "aidd-dev").code).toBe("flat-target-exists");
  });
});

describe("when FrameworkPlaceholderInPluginError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new FrameworkPlaceholderInPluginError("aidd-dev", "skills/x.md");
    expect({
      name: error.name,
      pluginName: error.pluginName,
      relativePath: error.relativePath,
      message: error.message,
    }).toStrictEqual({
      name: "FrameworkPlaceholderInPluginError",
      pluginName: "aidd-dev",
      relativePath: "skills/x.md",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new FrameworkPlaceholderInPluginError("aidd-dev", "skills/x.md").code).toBe(
      "framework-placeholder-in-plugin"
    );
  });
});

describe("when InvalidBuildPathsError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidBuildPathsError("/src", "/src/out");
    expect({
      name: error.name,
      sourceDir: error.sourceDir,
      outDir: error.outDir,
      message: error.message,
    }).toStrictEqual({
      name: "InvalidBuildPathsError",
      sourceDir: "/src",
      outDir: "/src/out",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidBuildPathsError("/src", "/src/out").code).toBe("invalid-build-paths");
  });
});

describe("when JsonSchemaValidationError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new JsonSchemaValidationError(["a", "b"]);
    expect({ name: error.name, errors: error.errors, message: error.message }).toStrictEqual({
      name: "JsonSchemaValidationError",
      errors: ["a", "b"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new JsonSchemaValidationError(["a", "b"]).code).toBe("json-schema-validation");
  });
});

describe("when MarketplaceOutDirNotEmptyError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new MarketplaceOutDirNotEmptyError("/out");
    expect({ name: error.name, outDir: error.outDir, message: error.message }).toStrictEqual({
      name: "MarketplaceOutDirNotEmptyError",
      outDir: "/out",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceOutDirNotEmptyError("/out").code).toBe("marketplace-out-dir-not-empty");
  });
});

describe("when OutDirNotDirectoryError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new OutDirNotDirectoryError("/out");
    expect({ name: error.name, outDir: error.outDir, message: error.message }).toStrictEqual({
      name: "OutDirNotDirectoryError",
      outDir: "/out",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new OutDirNotDirectoryError("/out").code).toBe("out-dir-not-directory");
  });
});
