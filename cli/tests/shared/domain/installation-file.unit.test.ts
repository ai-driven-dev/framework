import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../src/shared/domain/installation-file.js";

const HASH = new FileHash("d41d8cd98f00b204e9800998ecf8427e");

function file(relativePath: string): InstallationFile {
  return new InstallationFile({ relativePath, content: "", hash: HASH });
}

describe("InstallationFile", () => {
  it("defaults to no merge strategy", () => {
    expect(file("a.md").mergeStrategy).toBe("none");
  });
});
