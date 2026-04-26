import { describe, expect, it } from "vitest";
import {
  InvalidRepoFormatError,
  InvalidToolIdError,
  ManifestValidationError,
} from "../../src/domain/errors.js";
import { FileHash } from "../../src/domain/models/file.js";
import { validateRepoFormat } from "../../src/domain/models/manifest.js";
import { parseUpdateScope } from "../../src/domain/models/tool-scope.js";
import { assertValidToolIds } from "../../src/domain/tools/registry.js";

describe("validateRepoFormat", () => {
  it("throws InvalidRepoFormatError for missing slash", () => {
    expect(() => validateRepoFormat("noslash")).toThrow(InvalidRepoFormatError);
  });

  it("throws InvalidRepoFormatError for empty string", () => {
    expect(() => validateRepoFormat("")).toThrow(InvalidRepoFormatError);
  });

  it("includes expected message for invalid format", () => {
    expect(() => validateRepoFormat("bad format/repo")).toThrow("Invalid repository format");
  });

  it("does not throw for valid owner/repo format", () => {
    expect(() => validateRepoFormat("owner/repo")).not.toThrow();
  });
});

describe("ManifestValidationError from FileHash", () => {
  it("throws ManifestValidationError for invalid hash", () => {
    expect(() => new FileHash("not-a-hash")).toThrow(ManifestValidationError);
  });

  it("throws ManifestValidationError for uppercase hex", () => {
    expect(() => new FileHash("D41D8CD98F00B204E9800998ECF8427E")).toThrow(ManifestValidationError);
  });

  it("includes descriptive message for invalid hash", () => {
    expect(() => new FileHash("xyz")).toThrow("Invalid MD5 hash");
  });
});

describe("ManifestValidationError from parseUpdateScope", () => {
  it("throws ManifestValidationError for unknown scope", () => {
    expect(() => parseUpdateScope("invalid-scope")).toThrow(ManifestValidationError);
  });

  it("includes the invalid scope value in the message", () => {
    expect(() => parseUpdateScope("nope")).toThrow('"nope"');
  });
});

describe("assertValidToolIds", () => {
  it("throws InvalidToolIdError for unknown tool IDs", () => {
    expect(() => assertValidToolIds(["unknown-tool"])).toThrow(InvalidToolIdError);
  });

  it("includes unknown tool name in the message", () => {
    expect(() => assertValidToolIds(["vim"])).toThrow("vim");
  });

  it("lists all valid tools in the message", () => {
    expect(() => assertValidToolIds(["bad"])).toThrow("claude");
  });

  it("does not throw for valid tool IDs", () => {
    expect(() => assertValidToolIds(["claude", "cursor"])).not.toThrow();
  });
});
