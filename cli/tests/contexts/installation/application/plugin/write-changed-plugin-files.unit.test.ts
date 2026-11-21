import { describe, expect, it } from "vitest";
import { writeChangedPluginFiles } from "../../../../../src/contexts/installation/application/plugin/write-changed-plugin-files.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";

const BASE = "/base";

describe("writeChangedPluginFiles", () => {
  const file = (relativePath: string, content: string) =>
    new InstallationFile({ relativePath, content, hash: FileHash.of(content) });

  it("writes a missing or different file and counts it", async () => {
    const fs = new InMemoryFileAdapter({ "/base/b.md": "old" }, [BASE]);

    const written = await writeChangedPluginFiles(
      fs,
      [file("a.md", "a"), file("b.md", "new")],
      BASE
    );

    expect(written).toBe(2);
    expect(await fs.readFile("/base/a.md")).toBe("a");
    expect(await fs.readFile("/base/b.md")).toBe("new");
  });

  it("leaves a file already holding the content and does not count it", async () => {
    const fs = new InMemoryFileAdapter({ "/base/a.md": "a" }, [BASE]);

    expect(await writeChangedPluginFiles(fs, [file("a.md", "a")], BASE)).toBe(0);
  });
});
