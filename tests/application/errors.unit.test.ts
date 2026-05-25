import { describe, expect, it } from "vitest";
import {
  AdoptRequiresVersionError,
  AiddFilesDetectedError,
  NoManifestError,
} from "../../src/application/errors.js";
import { FlatTargetExistsError, OutDirNotDirectoryError } from "../../src/domain/errors.js";

describe("NoManifestError", () => {
  it("includes aidd setup hint in message", () => {
    const error = new NoManifestError();
    expect(error.message).toContain("aidd setup");
    expect(error.name).toBe("NoManifestError");
  });
});

describe("AiddFilesDetectedError", () => {
  it("includes setup hint in message", () => {
    const error = new AiddFilesDetectedError();
    expect(error.message).toContain("AIDD files detected but no manifest found");
    expect(error.message).toContain("aidd setup");
    expect(error.name).toBe("AiddFilesDetectedError");
  });
});

describe("AdoptRequiresVersionError", () => {
  it("includes adopt example in message", () => {
    const error = new AdoptRequiresVersionError();
    expect(error.message).toContain("--from <version|path> is required for adopt");
    expect(error.message).toContain("aidd setup --ai claude --from 3.6.0");
    expect(error.name).toBe("AdoptRequiresVersionError");
  });

  it("appends diagnostic suffix when provided", () => {
    const error = new AdoptRequiresVersionError("some diagnostic");
    expect(error.message).toContain("some diagnostic");
  });
});

describe("FlatTargetExistsError", () => {
  it("has correct error name", () => {
    const error = new FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.name).toBe("FlatTargetExistsError");
  });

  it("includes the conflicting path in the message", () => {
    const error = new FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.message).toContain("/out/.github/agents/my-plugin/foo.agent.md");
  });

  it("includes the plugin name in the message", () => {
    const error = new FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.message).toContain("my-plugin");
  });

  it("mentions --force hint in message", () => {
    const error = new FlatTargetExistsError(
      "/out/.github/agents/my-plugin/foo.agent.md",
      "my-plugin"
    );
    expect(error.message).toContain("--force");
  });
});

describe("OutDirNotDirectoryError", () => {
  it("has correct error name", () => {
    const error = new OutDirNotDirectoryError("/tmp/some-out");
    expect(error.name).toBe("OutDirNotDirectoryError");
  });

  it("includes the outDir path in the message", () => {
    const error = new OutDirNotDirectoryError("/tmp/some-out");
    expect(error.message).toContain("/tmp/some-out");
  });

  it("does not mention source directory in the message", () => {
    const error = new OutDirNotDirectoryError("/tmp/some-out");
    expect(error.message).not.toContain("--source");
    expect(error.message).toContain("not a directory");
  });
});
