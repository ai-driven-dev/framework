import { describe, expect, it } from "vitest";
import { ManifestValidationError } from "../../src/kernel/errors.js";
import { FileHash, InstallationFile, removeRedundantGitkeeps } from "../../src/kernel/file.js";

const HASH = new FileHash("d41d8cd98f00b204e9800998ecf8427e");

function file(relativePath: string): InstallationFile {
  return new InstallationFile({ relativePath, content: "", hash: HASH });
}

function pathsOf(files: readonly InstallationFile[]): string[] {
  return files.map((f) => f.relativePath);
}

describe("FileHash", () => {
  it("names the value it refused and the shape it wanted", () => {
    expect(() => new FileHash("abc")).toThrow(
      new ManifestValidationError('Invalid MD5 hash: "abc". Expected 32 lowercase hex characters.')
    );
  });
});

describe("InstallationFile", () => {
  it("defaults to no merge strategy", () => {
    expect(file("a.md").mergeStrategy).toBe("none");
  });
});

describe("removeRedundantGitkeeps", () => {
  it("drops a .gitkeep from a directory that holds another file", () => {
    const kept = removeRedundantGitkeeps([file("dir/.gitkeep"), file("dir/a.md")]);
    expect(pathsOf(kept)).toStrictEqual(["dir/a.md"]);
  });

  it("keeps a .gitkeep in a directory holding nothing else", () => {
    const kept = removeRedundantGitkeeps([file("empty/.gitkeep"), file("other/a.md")]);
    expect(pathsOf(kept)).toStrictEqual(["empty/.gitkeep", "other/a.md"]);
  });

  it("drops a .gitkeep two levels down when a sibling file sits beside it", () => {
    const kept = removeRedundantGitkeeps([file("a/b/.gitkeep"), file("a/b/c.md")]);
    expect(pathsOf(kept)).toStrictEqual(["a/b/c.md"]);
  });

  it("does not let a file in a subdirectory count for its parent", () => {
    const kept = removeRedundantGitkeeps([file("dir/.gitkeep"), file("dir/sub/a.md")]);
    expect(pathsOf(kept)).toStrictEqual(["dir/.gitkeep", "dir/sub/a.md"]);
  });

  it("does not let a file in the parent count for a subdirectory", () => {
    const kept = removeRedundantGitkeeps([file("dir/sub/.gitkeep"), file("dir/a.md")]);
    expect(pathsOf(kept)).toStrictEqual(["dir/sub/.gitkeep", "dir/a.md"]);
  });

  it("treats a file merely named like a gitkeep as an ordinary file", () => {
    const kept = removeRedundantGitkeeps([file("dir/my.gitkeep"), file("dir/a.md")]);
    expect(pathsOf(kept)).toStrictEqual(["dir/my.gitkeep", "dir/a.md"]);
  });

  it("returns the files it was given when none is a .gitkeep", () => {
    const kept = removeRedundantGitkeeps([file("a.md"), file("dir/b.md")]);
    expect(pathsOf(kept)).toStrictEqual(["a.md", "dir/b.md"]);
  });
});
