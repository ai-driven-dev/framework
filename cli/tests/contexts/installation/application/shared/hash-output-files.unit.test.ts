import { describe, expect, it } from "vitest";
import { hashOutputFiles } from "../../../../../src/contexts/installation/application/shared/hash-output-files.js";
import { HasherAdapter } from "../../../../../src/shared/infrastructure/hasher-adapter.js";

describe("hashOutputFiles", () => {
  it("tracks each translated file under the hash of its own content", () => {
    const hasher = new HasherAdapter();
    const files = hashOutputFiles(
      [
        { relativePath: "a.md", content: "alpha" },
        { relativePath: "b.md", content: "beta" },
      ],
      hasher
    );

    expect(files.map((f) => [f.relativePath, f.content, f.hash])).toEqual([
      ["a.md", "alpha", hasher.hash("alpha")],
      ["b.md", "beta", hasher.hash("beta")],
    ]);
  });
});
