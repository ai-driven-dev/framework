import { chmod, mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sameClone } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { readCloneIdentity } from "../../../../src/contexts/telemetry/infrastructure/consent/clone-identity-reader.js";

let base: string;
beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "aidd-identity-")));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("reading what a directory is", () => {
  it("is its identity, the same on every look", async () => {
    const dir = join(base, "d");
    await mkdir(dir);
    const first = await readCloneIdentity(dir);
    if (first === null || first === "unidentified") throw new Error(String(first));
    expect(first.path).toBe(dir);
    expect(first.ino).toMatch(/^[1-9]\d*$/u);
    expect(sameClone(first, (await readCloneIdentity(dir)) as typeof first)).toBe(true);
  });

  it("is another directory's identity once another is at the path", async () => {
    const dir = join(base, "d");
    await mkdir(dir);
    const first = await readCloneIdentity(dir);
    // Moved aside, not deleted: the file system may give a deleted directory's inode to the next.
    await rename(dir, join(base, "d.old"));
    await mkdir(dir);
    const second = await readCloneIdentity(dir);
    if (
      first === null ||
      second === null ||
      first === "unidentified" ||
      second === "unidentified"
    ) {
      throw new Error("lost");
    }
    expect(sameClone(first, second)).toBe(false);
  });

  it("is none where there is nothing", async () => {
    expect(await readCloneIdentity(join(base, "never"))).toBeNull();
  });

  it("is none where a file stands in the way of the path", async () => {
    await writeFile(join(base, "file"), "x");
    expect(await readCloneIdentity(join(base, "file", "below"))).toBeNull();
  });

  it("is unidentified for any reason other than absence, never a failure", async () => {
    expect(await readCloneIdentity(`${base}/x\0y`)).toBe("unidentified");
  });

  // `chmod` cannot shut a directory on Windows.
  it.skipIf(process.platform === "win32")(
    "is unidentified where the directory cannot be looked at",
    async () => {
      const shut = join(base, "shut");
      await mkdir(join(shut, "d"), { recursive: true });
      await chmod(shut, 0o000);
      try {
        expect(await readCloneIdentity(join(shut, "d"))).toBe("unidentified");
      } finally {
        await chmod(shut, 0o755);
      }
    }
  );
});
