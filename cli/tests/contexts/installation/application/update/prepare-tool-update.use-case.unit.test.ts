import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PrepareToolUpdate } from "../../../../../src/contexts/installation/application/update/prepare-tool-update.use-case.js";
import type { UpdateToolRequest } from "../../../../../src/contexts/installation/application/update/update-tool.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT = "/proj";
const TRACKED = "docs/a.md";

function manifestTracking(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", [
    new InstallationFile({
      relativePath: TRACKED,
      content: "original",
      hash: FileHash.of("original"),
    }),
  ]);
  return manifest;
}

async function prepare(
  options: { manifest?: Manifest | null; modified?: boolean } = {},
  overwriteModified: UpdateToolRequest["overwriteModified"] = async () => true
) {
  const conflict = vi.fn(async () => options.modified ?? false);
  const repo = new InMemoryManifestRepository(
    options.manifest === undefined ? manifestTracking() : options.manifest,
    PROJECT
  );
  const command = {
    toolId: TOOL.claude,
    projectRoot: PROJECT,
    version: "9.9.9",
    overwriteModified,
  };
  const prepared = await new PrepareToolUpdate({
    resolveSyncConflict: { execute: conflict },
    manifestRepo: repo,
  }).execute(command);
  return { prepared, conflict, command };
}

describe("preparing a tool's update", () => {
  it("runs over the saved manifest, for the command it was given", async () => {
    const { prepared, command } = await prepare();

    expect(prepared.command).toBe(command);
    expect(prepared.manifest.getToolFiles(TOOL.claude).map((f) => f.relativePath)).toStrictEqual([
      TRACKED,
    ]);
  });

  it("runs over an empty manifest when none is saved", async () => {
    const { prepared } = await prepare({ manifest: null });

    expect(prepared.manifest.toJSON()).toStrictEqual(Manifest.create().toJSON());
  });

  describe("the guard it hands the installer", () => {
    it("writes an unmodified file without asking", async () => {
      const ask = vi.fn(async () => false);
      const { prepared, conflict } = await prepare({ modified: false }, ask);

      expect(await prepared.guard(TRACKED)).toBe("write");
      expect(ask).not.toHaveBeenCalled();
      expect(conflict).toHaveBeenCalledWith({
        diskPath: join(PROJECT, TRACKED),
        recorded: FileHash.of("original"),
      });
    });

    it("compares an untracked file against no recorded hash", async () => {
      const { prepared, conflict } = await prepare({ modified: false });

      await prepared.guard("other.md");

      expect(conflict).toHaveBeenCalledWith(expect.objectContaining({ recorded: undefined }));
    });

    it("writes a modified file the answer says to overwrite", async () => {
      const ask = vi.fn(async () => true);
      const { prepared } = await prepare({ modified: true }, ask);

      expect(await prepared.guard(TRACKED)).toBe("write");
      expect(ask).toHaveBeenCalledWith(TRACKED);
    });

    it("skips a modified file the answer says to keep", async () => {
      const { prepared } = await prepare({ modified: true }, async () => false);

      expect(await prepared.guard(TRACKED)).toBe("skip");
    });
  });
});
