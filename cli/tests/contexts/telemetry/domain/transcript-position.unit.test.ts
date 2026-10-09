import { describe, expect, it } from "vitest";
import { resumeOffset } from "../../../../src/contexts/telemetry/domain/transcript-position.js";

const SINCE = { offset: 90, size: 100, identity: "1:42" };

describe("where a transcript is read from", () => {
  it("reads a file never read before from its start", () => {
    expect(resumeOffset(null, { size: 100, identity: "1:42" })).toEqual({
      offset: 0,
      restarted: false,
    });
  });

  it("resumes at the position when the file only grew", () => {
    expect(resumeOffset(SINCE, { size: 150, identity: "1:42" })).toEqual({
      offset: 90,
      restarted: false,
    });
  });

  it("resumes at the position when the file is unchanged", () => {
    expect(resumeOffset(SINCE, { size: 100, identity: "1:42" })).toEqual({
      offset: 90,
      restarted: false,
    });
  });

  it("reads a shrunk file whole", () => {
    expect(resumeOffset(SINCE, { size: 60, identity: "1:42" })).toEqual({
      offset: 0,
      restarted: true,
    });
  });

  it("reads a replaced file whole even when it is larger", () => {
    expect(resumeOffset(SINCE, { size: 500, identity: "1:77" })).toEqual({
      offset: 0,
      restarted: true,
    });
  });
});
