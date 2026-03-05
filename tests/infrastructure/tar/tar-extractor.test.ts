import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TarExtractor } from "../../../src/infrastructure/tar/tar-extractor.js";

const execFileAsync = promisify(execFile);

async function createTarball(sourceDir: string, outputTarball: string): Promise<void> {
  const parent = join(sourceDir, "..");
  const name = basename(sourceDir);
  await execFileAsync("tar", ["czf", outputTarball, "-C", parent, name]);
}

describe("TarExtractor", () => {
  let extractor: TarExtractor;
  let tempDir: string;

  beforeEach(async () => {
    extractor = new TarExtractor();
    tempDir = join(tmpdir(), `tar-extractor-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("flat extraction", () => {
    it("extracts tarball and returns the directory root", async () => {
      const sourceDir = join(tempDir, "framework");
      await mkdir(sourceDir);
      await writeFile(join(sourceDir, "readme.md"), "hello");
      await writeFile(join(sourceDir, "rules.md"), "rules");

      const tarball = join(tempDir, "framework.tar.gz");
      await createTarball(sourceDir, tarball);

      const extractDir = join(tempDir, "extracted");
      await mkdir(extractDir);

      const root = await extractor.extract(tarball, extractDir);
      expect(root).toBe(join(extractDir, "framework"));
    });
  });

  describe("single-directory nesting detection", () => {
    it("detects GitHub-style wrapping and returns inner framework root", async () => {
      const wrapperDir = join(tempDir, "org-repo-abc123");
      await mkdir(wrapperDir);
      await writeFile(join(wrapperDir, "readme.md"), "content");

      const tarball = join(tempDir, "github-release.tar.gz");
      await createTarball(wrapperDir, tarball);

      const extractDir = join(tempDir, "extracted");
      await mkdir(extractDir);

      const root = await extractor.extract(tarball, extractDir);
      expect(root).toBe(join(extractDir, "org-repo-abc123"));
    });

    it("handles double nesting", async () => {
      const outerDir = join(tempDir, "outer");
      const innerDir = join(outerDir, "inner");
      await mkdir(innerDir, { recursive: true });
      await writeFile(join(innerDir, "readme.md"), "content");

      const tarball = join(tempDir, "double-nested.tar.gz");
      await execFileAsync("tar", ["czf", tarball, "-C", tempDir, "outer"]);

      const extractDir = join(tempDir, "extracted");
      await mkdir(extractDir);

      const root = await extractor.extract(tarball, extractDir);
      expect(root).toBe(join(extractDir, "outer", "inner"));
    });
  });

  describe("error handling", () => {
    it("throws clear error on invalid tarball", async () => {
      const fakeTarball = join(tempDir, "fake.tar.gz");
      await writeFile(fakeTarball, "this is not a tarball");

      const extractDir = join(tempDir, "extracted");
      await mkdir(extractDir);

      await expect(extractor.extract(fakeTarball, extractDir)).rejects.toThrow(
        "Failed to extract tarball"
      );
    });
  });
});
