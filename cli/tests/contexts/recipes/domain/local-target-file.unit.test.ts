import path from "node:path";
import { describe, expect, it } from "vitest";
import { localTargetFile } from "../../../../src/contexts/recipes/domain/local-target-file.js";

describe("finding the file a link points to", () => {
  it("names the linking file itself when the link gives no path", () => {
    expect(localTargetFile("/r/a.md", "")).toBe("/r/a.md");
  });

  it("resolves a decoded path against the linking file's folder", () => {
    expect(localTargetFile("/r/a.md", "sub/my%20file.md")).toBe(path.resolve("/r/sub/my file.md"));
  });

  it("names nothing when the path is not valid URI encoding", () => {
    expect(localTargetFile("/r/a.md", "bad%E0%A4%A.md")).toBeUndefined();
  });
});
