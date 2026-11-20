import { describe, expect, it, vi } from "vitest";
import { RestoreTool } from "../../../../../../src/contexts/installation/application/restore/project/restore-tool.js";
import type { Restore } from "../../../../../../src/contexts/installation/application/restore/restore.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { ManifestUnavailableError } from "../../../../../../src/shared/domain/errors.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { InMemoryManifestRepository } from "../../../testing/in-memory-manifest-repository.fake.js";

const CURRENT = "9.9.9";
const RESTORED: Awaited<ReturnType<Restore["execute"]>> = {
  tools: [],
  totalRestored: 0,
  totalKept: 0,
  totalPluginFilesRestored: 0,
  restoredPluginNames: [],
  unrestorable: [],
  nativeOnlyToolIds: [],
};

function setup(manifest: Manifest | null) {
  const restore = vi.fn<Restore["execute"]>().mockResolvedValue(RESTORED);
  const repo = new InMemoryManifestRepository(manifest);
  const load = vi.spyOn(repo, "load");
  const useCase = new RestoreTool(repo, { execute: restore }, { get: () => CURRENT });
  return { useCase, restore, load };
}

const command = { projectRoot: "/p", force: false, interactive: false };

describe("RestoreTool", () => {
  it("restores the tool at the version the manifest recorded, handing over the manifest it read", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "5.1.0", []);
    const { useCase, restore, load } = setup(manifest);

    await useCase.execute({ ...command, toolId: TOOL.claude, files: ["a.md"], pluginName: "p" });

    expect(restore).toHaveBeenCalledWith({
      version: "5.1.0",
      projectRoot: "/p",
      toolIds: [TOOL.claude],
      files: ["a.md"],
      force: false,
      interactive: false,
      manifest,
      pluginName: "p",
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("falls back to this CLI's version when the manifest records none for that tool", async () => {
    const { useCase, restore } = setup(Manifest.create());

    await useCase.execute({ ...command, toolId: TOOL.claude });

    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ version: CURRENT }));
  });

  it("refuses a project with no manifest by code, before restoring anything", async () => {
    const { useCase, restore } = setup(null);

    const failure = await useCase.execute({ ...command, toolId: TOOL.claude }).catch((e) => e);

    expect(failure).toBeInstanceOf(ManifestUnavailableError);
    expect(failure.code).toBe("manifest-missing");
    expect(restore).not.toHaveBeenCalled();
  });
});
