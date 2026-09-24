import { describe, expect, it } from "vitest";
import { isBareFileName } from "../../../src/kernel/reading/confined-file-name.js";

describe("isBareFileName", () => {
  it("accepts a plain file name", () => {
    expect(isBareFileName("manifest.json")).toBe(true);
  });

  it("refuses an empty name", () => {
    expect(isBareFileName("")).toBe(false);
  });

  it("refuses the directory itself", () => {
    expect(isBareFileName(".")).toBe(false);
  });

  it("refuses the parent directory", () => {
    expect(isBareFileName("..")).toBe(false);
  });

  it("refuses a name that walks out of the directory", () => {
    expect(isBareFileName("../manifest.json")).toBe(false);
  });

  it("refuses a nested path", () => {
    expect(isBareFileName("sub/manifest.json")).toBe(false);
  });

  it("refuses an absolute path", () => {
    expect(isBareFileName("/etc/passwd")).toBe(false);
  });
});
