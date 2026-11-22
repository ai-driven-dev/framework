import { describe, expect, it } from "vitest";
import {
  tryRealpath,
  userPluginsBoundary,
} from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-boundary.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../shared/testing/faulting-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

describe("the directory a tool keeps its user plugins in", () => {
  it("is null for a tool that declares none", () => {
    expect(userPluginsBoundary(registeredTools().aiProfile(TOOL.claude), "/home/u")).toBeNull();
  });

  it("is the tool's user plugins base directory under the home", () => {
    expect(userPluginsBoundary(registeredTools().aiProfile(TOOL.cursor), "/home/u")).toBe(
      "/home/u/.cursor/plugins/local"
    );
  });
});

describe("resolving a path through its symlinks", () => {
  it("answers null for an absent path and propagates any other failure", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", "/gone", errnoError("ENOENT"));
    fs.failOn("realpath", "/locked", errnoError("EACCES"));

    expect(await tryRealpath(fs, "/gone")).toBeNull();
    await expect(tryRealpath(fs, "/locked")).rejects.toThrow("EACCES");
  });
});
