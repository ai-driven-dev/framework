import { describe, expect, it } from "vitest";
import {
  AdoptRequiresVersionError,
  AiddFilesDetectedError,
  NoManifestError,
} from "../../src/application/errors.js";

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
