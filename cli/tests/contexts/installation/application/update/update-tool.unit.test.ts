import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { InstallIdeConfig } from "../../../../../src/contexts/installation/application/install/config/install-ide-config.js";
import type { InstallRuntimeConfig } from "../../../../../src/contexts/installation/application/install/config/install-runtime-config.js";
import {
  UpdateTool,
  type UpdateToolCommand,
} from "../../../../../src/contexts/installation/application/update/update-tool.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { InputRequiredError } from "../../../../../src/shared/domain/shared.error.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT = "/proj";
const TRACKED = "docs/a.md";

type Install = InstallRuntimeConfig["execute"];
type InstallIde = InstallIdeConfig["execute"];

function manifestTracking(toolId = TOOL.claude): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(toolId, "1.0.0", [
    new InstallationFile({
      relativePath: TRACKED,
      content: "original",
      hash: FileHash.of("original"),
    }),
  ]);
  return manifest;
}

function setup(
  options: {
    manifest?: Manifest | null;
    modified?: boolean;
    runtime?: Install;
    ide?: InstallIde;
  } = {}
) {
  const done = { toolId: TOOL.claude, fileCount: 3, files: [], skipped: false, warnings: [] };
  const doneIde = { ...done, toolId: TOOL.vscode };
  const runtime = vi.fn<Install>(options.runtime ?? (async () => done));
  const ide = vi.fn(options.ide ?? (async () => doneIde));
  const conflict = vi.fn(async () => options.modified ?? false);
  const repo = new InMemoryManifestRepository(
    options.manifest === undefined ? manifestTracking() : options.manifest,
    PROJECT
  );
  const tool = new UpdateTool(
    {
      installRuntimeConfig: { execute: runtime },
      installIdeConfig: { execute: ide },
      resolveSyncConflict: { execute: conflict },
      manifestRepo: repo,
    },
    registeredTools()
  );
  return { tool, runtime, ide, conflict };
}

function commandOf(
  overwriteModified: UpdateToolCommand["overwriteModified"] = async () => true,
  toolId: UpdateToolCommand["toolId"] = TOOL.claude
): UpdateToolCommand {
  return { toolId, projectRoot: PROJECT, version: "9.9.9", overwriteModified };
}

describe("UpdateTool", () => {
  it("installs an AI tool through the runtime installer, forced, at the command's version", async () => {
    const { tool, runtime, ide } = setup();

    const result = await tool.execute(commandOf());

    expect(result).toStrictEqual({ kind: "updated", toolId: TOOL.claude, fileCount: 3 });
    expect(ide).not.toHaveBeenCalled();
    expect(runtime).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: TOOL.claude,
        projectRoot: PROJECT,
        version: "9.9.9",
        force: true,
      })
    );
  });

  it("installs an IDE tool through the IDE installer", async () => {
    const { tool, runtime, ide } = setup();

    await tool.execute(commandOf(undefined, TOOL.vscode));

    expect(runtime).not.toHaveBeenCalled();
    expect(ide).toHaveBeenCalledWith(expect.objectContaining({ toolId: TOOL.vscode }));
  });

  it("installs over an empty manifest when none is saved", async () => {
    const { tool, runtime } = setup({ manifest: null });

    await tool.execute(commandOf());

    expect(runtime.mock.calls[0]?.[0]).toMatchObject({ manifest: expect.any(Manifest) });
  });

  it("answers skipped when the installer skipped the tool", async () => {
    const { tool } = setup({
      runtime: async () => ({
        toolId: TOOL.claude,
        fileCount: 0,
        files: [],
        skipped: true,
        warnings: [],
      }),
    });

    expect(await tool.execute(commandOf())).toStrictEqual({ kind: "skipped" });
  });

  it.each([
    ["an Error", new Error("disk full")],
    ["a plain string", "plain string"],
  ])("answers failed with %s the installer rejected with", async (_n, rejection) => {
    const { tool } = setup({
      runtime: async () => {
        throw rejection;
      },
    });

    expect(await tool.execute(commandOf())).toStrictEqual({ kind: "failed", error: rejection });
  });

  it("lets an InputRequiredError stop the run", async () => {
    const { tool } = setup({
      runtime: async () => {
        throw new InputRequiredError("use --force");
      },
    });

    await expect(tool.execute(commandOf())).rejects.toThrow(InputRequiredError);
  });

  describe("the guard it hands the installer", () => {
    async function guardOf(
      setupOptions: Parameters<typeof setup>[0],
      overwriteModified: UpdateToolCommand["overwriteModified"]
    ) {
      const s = setup(setupOptions);
      await s.tool.execute(commandOf(overwriteModified));
      const gate = s.runtime.mock.calls[0]?.[0].onBeforeWriteRegularFile;
      if (gate === undefined) throw new Error("the installer was handed no gate");
      return { ...s, gate };
    }

    it("writes an unmodified file without asking", async () => {
      const ask = vi.fn(async () => false);
      const { gate, conflict } = await guardOf({ modified: false }, ask);

      expect(await gate(TRACKED)).toBe("write");
      expect(ask).not.toHaveBeenCalled();
      expect(conflict).toHaveBeenCalledWith({
        diskTargetPath: join(PROJECT, TRACKED),
        targetRelativePath: TRACKED,
        targetManifestMap: new Map([[TRACKED, FileHash.of("original")]]),
      });
    });

    it("compares an untracked file against no recorded hash", async () => {
      const { gate, conflict } = await guardOf({ modified: false }, async () => true);

      await gate("other.md");

      expect(conflict).toHaveBeenCalledWith(
        expect.objectContaining({ targetManifestMap: new Map() })
      );
    });

    it("writes a modified file the answer says to overwrite", async () => {
      const ask = vi.fn(async () => true);
      const { gate } = await guardOf({ modified: true }, ask);

      expect(await gate(TRACKED)).toBe("write");
      expect(ask).toHaveBeenCalledWith(TRACKED);
    });

    it("skips a modified file the answer says to keep", async () => {
      const { gate } = await guardOf({ modified: true }, async () => false);

      expect(await gate(TRACKED)).toBe("skip");
    });
  });
});
