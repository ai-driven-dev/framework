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

  it("hashes the content it is built from and defaults to no merge strategy", () => {
    const built = InstallationFile.hashing("a.json", "{}");

    expect(built.hash).toStrictEqual(FileHash.of("{}"));
    expect(built.mergeStrategy).toBe("none");
  });

  it("carries the merge strategy it is given", () => {
    expect(InstallationFile.hashing("a.json", "{}", "user-prime").mergeStrategy).toBe("user-prime");
  });
});
