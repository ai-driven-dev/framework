import { describe, expect, it } from "vitest";
import { caseInsensitiveFileSystem } from "../../../src/runtime/wiring/telemetry.js";

describe("which file systems answer one directory to several spellings", () => {
  it.each([
    ["darwin", true],
    ["win32", true],
    ["linux", false],
    ["freebsd", false],
  ] as const)("%s: %s", (platform, expected) => {
    expect(caseInsensitiveFileSystem(platform)).toBe(expected);
  });
});
