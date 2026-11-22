import { describe, expect, it } from "vitest";
import { hashOutputFiles } from "../../../../../src/contexts/installation/application/shared/hash-output-files.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";

describe("hashing the translated files", () => {
  it("tracks each translated file under the hash of its own content", () => {
    const files = hashOutputFiles([
      { relativePath: "a.md", content: "alpha" },
      { relativePath: "b.md", content: "beta" },
    ]);

    expect(files.map((f) => [f.relativePath, f.content, f.hash])).toEqual([
      ["a.md", "alpha", FileHash.of("alpha")],
      ["b.md", "beta", FileHash.of("beta")],
    ]);
  });
});
