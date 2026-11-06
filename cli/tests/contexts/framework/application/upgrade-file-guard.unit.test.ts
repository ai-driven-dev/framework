import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { protectUpgradeWrites } from "../../../../src/contexts/framework/application/upgrade-file-guard.js";
import { FileAdapter } from "../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../src/runtime/filesystem/hasher-adapter.js";

describe("upgrade file protection", () => {
  it("refuses to overwrite an untracked file and keeps its bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "upgrade-guard-"));
    try {
      const path = join(root, "mine.txt");
      await writeFile(path, "user content");
      const guarded = protectUpgradeWrites(new FileAdapter(new HasherAdapter()), root, new Map());
      await expect(guarded.writeFile(path, "plugin content")).rejects.toThrow(/untracked/);
      expect(await readFile(path, "utf8")).toBe("user content");
      await guarded.writeFile(join(root, "new.txt"), "new content");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
