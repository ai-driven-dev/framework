import { describe, expect, it } from "vitest";
import { AssertProjectPathWithinRoot } from "../../../../../../src/contexts/installation/application/ownership/assert-project-path-within-root.use-case.js";
import { WriteProjectMcpRewrite } from "../../../../../../src/contexts/installation/application/removal/project/write-project-mcp-rewrite.use-case.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";

const ROOT = "/project";
const OUTPUT = "/project/opencode.json";

function writer(fs: InMemoryFileAdapter) {
  return new WriteProjectMcpRewrite(fs, new AssertProjectPathWithinRoot(fs));
}

describe("writing a planned config rewrite", () => {
  it("writes the planned content over the file", async () => {
    const fs = new InMemoryFileAdapter({ [OUTPUT]: "{}" }, [ROOT]);

    await writer(fs).execute({ output: OUTPUT, content: '{ "mcp": {} }' }, ROOT);

    expect(fs.getFile(OUTPUT)).toBe('{ "mcp": {} }');
  });

  it("refuses a file that resolves outside the project and leaves it as it was", async () => {
    const fs = new InMemoryFileAdapter({ [OUTPUT]: "{}", "/foreign/o.json": "{}" }, [ROOT]);
    fs.setSymlink(OUTPUT, "/foreign/o.json");

    await expect(writer(fs).execute({ output: OUTPUT, content: "x" }, ROOT)).rejects.toThrow(
      /outside.*project|escapes.*project/
    );
    expect(fs.getFile("/foreign/o.json")).toBe("{}");
  });
});
