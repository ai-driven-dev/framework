import { describe, expect, it } from "vitest";
import { RestoreGlobal } from "../../../../../../src/contexts/installation/application/restore/project/restore-global.use-case.js";
import type { Restore } from "../../../../../../src/contexts/installation/application/restore/restore.use-case.js";
import { ManifestUnavailableError } from "../../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

type RestoreCommand = Parameters<Restore["execute"]>[0];

function recordingRestore() {
  const received: RestoreCommand[] = [];
  const restore: Pick<Restore, "execute"> = {
    execute: async (command) => {
      received.push(command);
      return {
        tools: [],
        totalRestored: 2,
        totalKept: 1,
        totalPluginFilesRestored: 5,
        restoredPluginNames: ["alpha"],
        unrestorable: ["gone.md"],
        nativeOnlyToolIds: [TOOL.codex],
      };
    },
  };
  return { restore, received };
}

function recordWith(version: string): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, version, []);
  return manifest;
}

const run = { projectRoot: "/test-project", force: false, interactive: false };

describe("RestoreGlobal", () => {
  it("refuses a project that has no record", async () => {
    const { restore } = recordingRestore();
    const restoreGlobal = new RestoreGlobal(new InMemoryManifestRepository(), restore);

    await expect(restoreGlobal.open()).rejects.toBeInstanceOf(ManifestUnavailableError);
  });

  it("restores from the record it opened, at the version the record holds", async () => {
    const { restore, received } = recordingRestore();
    const manifest = recordWith("1.4.0");
    const open = await new RestoreGlobal(new InMemoryManifestRepository(manifest), restore).open();

    const result = await open.execute({ ...run, files: ["a.md"] });

    expect(received[0]).toMatchObject({ version: "1.4.0", files: ["a.md"], manifest });
    expect(result).toStrictEqual({
      totalRestored: 2,
      totalKept: 1,
      restoredPluginNames: ["alpha"],
      unrestorable: ["gone.md"],
      nativeOnlyToolIds: [TOOL.codex],
    });
  });

  it("restores at an unknown version when the record holds no tool", async () => {
    const { restore, received } = recordingRestore();
    const open = await new RestoreGlobal(
      new InMemoryManifestRepository(Manifest.create()),
      restore
    ).open();

    await open.execute(run);

    expect(received[0]?.version).toBe("unknown");
  });

  it("does not ask twice: an interactive run has already consented to overwrite", async () => {
    const { restore, received } = recordingRestore();
    const open = await new RestoreGlobal(
      new InMemoryManifestRepository(recordWith("1.0.0")),
      restore
    ).open();

    await open.execute({ ...run, interactive: true });
    await open.execute({ ...run, force: true });
    await open.execute(run);

    expect(received.map((command) => command.force)).toStrictEqual([true, true, false]);
  });
});
