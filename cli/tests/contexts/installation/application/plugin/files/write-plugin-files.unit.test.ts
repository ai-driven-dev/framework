import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writePluginFiles } from "../../../../../../src/contexts/installation/application/plugin/files/write-plugin-files.js";
import { InstallationFile } from "../../../../../../src/shared/domain/installation-file.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";

describe("writing plugin files under a base directory", () => {
  it("writes every file under the base directory", async () => {
    const fs = new InMemoryFileAdapter();

    await writePluginFiles(
      [InstallationFile.hashing("a/first.md", "1"), InstallationFile.hashing("b/second.md", "2")],
      "/base",
      fs
    );

    expect(fs.getFile(join("/base", "a/first.md"))).toBe("1");
    expect(fs.getFile(join("/base", "b/second.md"))).toBe("2");
  });
});
