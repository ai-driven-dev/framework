import { describe, expect, it } from "vitest";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.js";
import { LoadManifestForDoctor } from "../../../../../src/contexts/installation/application/doctor/load-manifest-for-doctor.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const file = new InstallationFile({
  relativePath: "a.md",
  content: "x",
  hash: new FileHash("abc123abc123abc123abc123abc123ab"),
});

function doctorOver(repo: InMemoryManifestRepository) {
  return new LoadManifestForDoctor(new LoadManifest(repo));
}

describe("LoadManifestForDoctor", () => {
  const manifest = () =>
    aManifest().withTool(TOOL.claude, [file]).withTool(TOOL.cursor, []).build();

  it("answers the health of every installed tool", async () => {
    const view = await doctorOver(new InMemoryManifestRepository(manifest())).execute({
      allowedIds: null,
    });

    expect(view.toolIds).toEqual([TOOL.claude, TOOL.cursor]);
    expect(view.toolHealth).toEqual([
      { toolId: TOOL.claude, fileCount: 1, mergeFileCount: 0 },
      { toolId: TOOL.cursor, fileCount: 0, mergeFileCount: 0 },
    ]);
  });

  it("reports health only for the allowed tools, yet lists every installed id", async () => {
    const view = await doctorOver(new InMemoryManifestRepository(manifest())).execute({
      allowedIds: new Set([TOOL.cursor]),
    });

    expect(view.toolIds).toEqual([TOOL.claude, TOOL.cursor]);
    expect(view.toolHealth.map((h) => h.toolId)).toEqual([TOOL.cursor]);
  });

  it("fails with the loader's error when no manifest exists", async () => {
    await expect(
      doctorOver(new InMemoryManifestRepository()).execute({ allowedIds: null })
    ).rejects.toMatchObject({ code: "manifest-missing" });
  });
});
