import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeObsoletePluginFiles } from "../../../../../../src/contexts/installation/application/plugin/files/remove-obsolete-plugin-files.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";

const BASE = "/test-project/.tool";

describe("removing the files a new install no longer ships", () => {
  it("deletes an unedited file the new set drops and keeps the rest", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(BASE, "old.js"), "old");
    fs.setFile(join(BASE, "kept.js"), "kept");
    const previous = new Map([
      ["old.js", FileHash.of("old").value],
      ["kept.js", FileHash.of("kept").value],
    ]);

    await removeObsoletePluginFiles(fs, previous, {
      current: new Set(["kept.js"]),
      base: { dir: BASE, scope: "project" },
    });

    expect(await fs.fileExists(join(BASE, "old.js"))).toBe(false);
    expect(await fs.fileExists(join(BASE, "kept.js"))).toBe(true);
  });

  it("keeps a dropped file the user edited", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(BASE, "old.js"), "edited by the user");
    const previous = new Map([["old.js", FileHash.of("old").value]]);

    await removeObsoletePluginFiles(fs, previous, {
      current: new Set(),
      base: { dir: BASE, scope: "project" },
    });

    expect(await fs.fileExists(join(BASE, "old.js"))).toBe(true);
  });
});
