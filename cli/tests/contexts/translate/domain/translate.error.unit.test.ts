import { describe, expect, it } from "vitest";
import {
  FlatMergeTargetNotJsonError,
  FlatTargetExistsError,
  FrameworkPlaceholderInPluginError,
  InvalidBuildPathsError,
  JsonSchemaValidationError,
  MarketplaceOutDirNotEmptyError,
  OutDirNotDirectoryError,
} from "../../../../src/contexts/translate/domain/translate.error.js";

describe("FlatMergeTargetNotJsonError", () => {
  it("says exactly what went wrong", () => {
    const error = new FlatMergeTargetNotJsonError("f.json", "Unexpected token");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FlatMergeTargetNotJsonError",
      message: "f.json is not valid JSON (Unexpected token); left untouched.",
    });
  });

  it("carries its stable code", () => {
    expect(new FlatMergeTargetNotJsonError("f.json", "Unexpected token").code).toBe(
      "flat-merge-target-not-json"
    );
  });
});

describe("FlatTargetExistsError", () => {
  it("says exactly what went wrong", () => {
    const error = new FlatTargetExistsError("/out/a.md", "aidd-dev");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FlatTargetExistsError",
      message:
        "Flat build conflict: '/out/a.md' already exists (plugin 'aidd-dev'). Re-run with --force to overwrite.",
    });
  });

  it("carries its stable code", () => {
    expect(new FlatTargetExistsError("/out/a.md", "aidd-dev").code).toBe("flat-target-exists");
  });
});

describe("FrameworkPlaceholderInPluginError", () => {
  it("says exactly what went wrong", () => {
    const error = new FrameworkPlaceholderInPluginError("aidd-dev", "skills/x.md");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FrameworkPlaceholderInPluginError",
      message:
        "Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin 'aidd-dev' (file: skills/x.md).",
    });
  });

  it("carries its stable code", () => {
    expect(new FrameworkPlaceholderInPluginError("aidd-dev", "skills/x.md").code).toBe(
      "framework-placeholder-in-plugin"
    );
  });
});

describe("InvalidBuildPathsError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidBuildPathsError("/src", "/src/out");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidBuildPathsError",
      message:
        "Refusing to build: --out '/src/out' and --source '/src' must not contain each other.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidBuildPathsError("/src", "/src/out").code).toBe("invalid-build-paths");
  });
});

describe("JsonSchemaValidationError", () => {
  it("says exactly what went wrong", () => {
    const error = new JsonSchemaValidationError(["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "JsonSchemaValidationError",
      message: "Manifest validation failed: a; b",
    });
  });

  it("carries its stable code", () => {
    expect(new JsonSchemaValidationError(["a", "b"]).code).toBe("json-schema-validation");
  });
});

describe("MarketplaceOutDirNotEmptyError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceOutDirNotEmptyError("/out");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceOutDirNotEmptyError",
      message:
        "Refusing to build: '/out' is not empty. Re-run with --force to overwrite files this build produces, or choose an empty --out directory.",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceOutDirNotEmptyError("/out").code).toBe("marketplace-out-dir-not-empty");
  });
});

describe("OutDirNotDirectoryError", () => {
  it("says exactly what went wrong", () => {
    const error = new OutDirNotDirectoryError("/out");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "OutDirNotDirectoryError",
      message: "Refusing to build: --out '/out' does not exist or is not a directory.",
    });
  });

  it("carries its stable code", () => {
    expect(new OutDirNotDirectoryError("/out").code).toBe("out-dir-not-directory");
  });
});
