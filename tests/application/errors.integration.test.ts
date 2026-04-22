import { describe, expect, it } from "vitest";
import {
  AdoptRequiresVersionError,
  AiddFilesDetectedError,
  NoManifestError,
} from "../../src/application/errors.js";

describe("NoManifestError", () => {
  it("uses default repo in message", () => {
    const error = new NoManifestError();
    expect(error.message).toContain("aidd setup");
    expect(error.message).toContain("ai-driven-dev/aidd-framework");
    expect(error.name).toBe("NoManifestError");
  });

  it("uses custom repo in message", () => {
    const error = new NoManifestError("myorg/my-repo");
    expect(error.message).toContain("myorg/my-repo");
  });
});

describe("AiddFilesDetectedError", () => {
  it("uses default repo in message", () => {
    const error = new AiddFilesDetectedError();
    expect(error.message).toContain("AIDD files detected but no manifest found");
    expect(error.message).toContain("aidd setup");
    expect(error.message).toContain("ai-driven-dev/aidd-framework");
    expect(error.name).toBe("AiddFilesDetectedError");
  });

  it("uses custom repo in message", () => {
    const error = new AiddFilesDetectedError("myorg/my-repo");
    expect(error.message).toContain("myorg/my-repo");
  });
});

describe("AdoptRequiresVersionError", () => {
  it("uses default repo in message", () => {
    const error = new AdoptRequiresVersionError();
    expect(error.message).toContain("--from <version|path> is required for adopt");
    expect(error.message).toContain("aidd setup --ai claude --from 3.6.0");
    expect(error.message).toContain("Check available tags for: ai-driven-dev/aidd-framework");
    expect(error.name).toBe("AdoptRequiresVersionError");
  });

  it("uses custom repo in message", () => {
    const error = new AdoptRequiresVersionError("myorg/my-repo");
    expect(error.message).toContain("Check available tags for: myorg/my-repo");
  });
});
