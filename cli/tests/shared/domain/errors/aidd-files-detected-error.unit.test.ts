import { describe, expect, it } from "vitest";
import { AiddFilesDetectedError } from "../../../../src/shared/domain/errors/aidd-files-detected-error.js";

describe("AiddFilesDetectedError", () => {
  it("includes setup hint in message", () => {
    const error = new AiddFilesDetectedError();
    expect(error.message).toContain("AIDD files detected but no manifest found");
    expect(error.message).toContain("aidd setup");
    expect(error.name).toBe("AiddFilesDetectedError");
  });

  it("says exactly what went wrong", () => {
    const error = new AiddFilesDetectedError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AiddFilesDetectedError",
      message:
        "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files.",
    });
  });

  it("carries its stable code", () => {
    expect(new AiddFilesDetectedError().code).toBe("aidd-files-detected");
  });
});
