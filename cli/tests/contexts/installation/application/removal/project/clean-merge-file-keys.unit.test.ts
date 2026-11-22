import { describe, expect, it } from "vitest";
import { cleanMergeFileKeys } from "../../../../../../src/contexts/installation/application/removal/project/clean-merge-file-keys.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";

const ROOT = "/project";
const FILE = "/project/.tool/mcp.json";

function entry(keys: readonly string[]) {
  const entries = Object.fromEntries(keys.map((key) => [key, FileHash.of(key)]));
  return { relativePath: ".tool/mcp.json", sectionKey: "servers", entries };
}

describe("cleanMergeFileKeys", () => {
  it("keeps the keys the install did not merge and counts the file", async () => {
    const content = JSON.stringify({ servers: { mine: 1, theirs: 2 } });
    const fs = new InMemoryFileAdapter({ [FILE]: content }, [ROOT]);

    const count = await cleanMergeFileKeys(fs, [entry(["mine"])], ROOT);

    expect(count).toBe(1);
    expect(JSON.parse(await fs.readFile(FILE))).toEqual({ servers: { theirs: 2 } });
  });

  it("deletes a file once its merged keys were all it held", async () => {
    const fs = new InMemoryFileAdapter({ [FILE]: JSON.stringify({ servers: { mine: 1 } }) }, [
      ROOT,
    ]);

    await cleanMergeFileKeys(fs, [entry(["mine"])], ROOT);

    expect(await fs.fileExists(FILE)).toBe(false);
  });

  it("deletes a file when the install recorded no keys for it", async () => {
    const fs = new InMemoryFileAdapter({ [FILE]: "{}" }, [ROOT]);

    await cleanMergeFileKeys(fs, [entry([])], ROOT);

    expect(await fs.fileExists(FILE)).toBe(false);
  });

  it("skips a file that is already gone", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    expect(await cleanMergeFileKeys(fs, [entry(["mine"])], ROOT)).toBe(0);
  });
});
