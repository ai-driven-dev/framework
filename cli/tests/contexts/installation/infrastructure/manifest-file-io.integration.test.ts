import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/manifest-repository-adapter.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../testing/manifest.builder.js";
import { manifestFileDeps } from "../testing/manifest-file-deps.builder.js";

// What every scope's manifest file shares and the repository contract does not state: how a write
// replaces the file, and that only a missing file reads as none.
describe("manifest file", () => {
  let root: string;
  let file: ManifestRepositoryAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-manifest-io-"));
    file = new ManifestRepositoryAdapter(
      root,
      manifestFileDeps(() => join(root, ".aidd"))
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("overwrites what a previous write left", async () => {
    await file.save(aManifest().withTool(TOOL.claude, []).build());

    await file.save(aManifest().build());

    expect((await file.load())?.getInstalledToolIds()).toStrictEqual([]);
  });

  it("rethrows a read failure other than a missing file", async () => {
    await mkdir(file.path, { recursive: true });

    await expect(file.load()).rejects.toThrow("EISDIR");
  });
});
