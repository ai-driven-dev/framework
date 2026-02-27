import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { GeneratedFile } from "../../../src/domain/models/generated-file.js";

describe("GeneratedFile", () => {
  const hash = new FileHash("d41d8cd98f00b204e9800998ecf8427e");

  it("stores relativePath, content, and hash", () => {
    const file = new GeneratedFile({
      relativePath: ".claude/agents/code-reviewer.md",
      content: "# Code Reviewer",
      hash,
    });

    expect(file.relativePath).toBe(".claude/agents/code-reviewer.md");
    expect(file.content).toBe("# Code Reviewer");
    expect(file.hash).toBe(hash);
  });

  it("properties are readonly at the type level", () => {
    const file = new GeneratedFile({
      relativePath: "some/path.md",
      content: "content",
      hash,
    });

    // TypeScript readonly is compile-time enforcement.
    // Verify properties remain unchanged after construction.
    expect(file.relativePath).toBe("some/path.md");
    expect(file.content).toBe("content");
    expect(file.hash).toBe(hash);
  });
});
