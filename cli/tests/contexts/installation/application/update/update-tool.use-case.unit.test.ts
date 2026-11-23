import { describe, expect, it, vi } from "vitest";
import type { InstallIdeConfig } from "../../../../../src/contexts/installation/application/install/config/install-ide-config.use-case.js";
import type { InstallRuntimeConfig } from "../../../../../src/contexts/installation/application/install/config/install-runtime-config.use-case.js";
import {
  type PreparedUpdate,
  UpdateTool,
  type UpdateToolRequest,
} from "../../../../../src/contexts/installation/application/update/update-tool.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT = "/proj";

type Install = InstallRuntimeConfig["execute"];
type InstallIde = InstallIdeConfig["execute"];

function setup(options: { runtime?: Install; ide?: InstallIde } = {}) {
  const done = { toolId: TOOL.claude, fileCount: 3, files: [], skipped: false, warnings: [] };
  const doneIde = { ...done, toolId: TOOL.vscode };
  const runtime = vi.fn<Install>(options.runtime ?? (async () => done));
  const ide = vi.fn(options.ide ?? (async () => doneIde));
  const tool = new UpdateTool(
    { installRuntimeConfig: { execute: runtime }, installIdeConfig: { execute: ide } },
    registeredTools()
  );
  return { tool, runtime, ide };
}

const guard = async () => "write" as const;
const manifest = Manifest.create();

function preparedFor(toolId: UpdateToolRequest["toolId"] = TOOL.claude): PreparedUpdate {
  const command = {
    toolId,
    projectRoot: PROJECT,
    version: "9.9.9",
    overwriteModified: async () => true,
  };
  return { command, manifest, guard };
}

describe("updating an installed tool", () => {
  it("installs an AI tool through the runtime installer, forced, at the command's version", async () => {
    const { tool, runtime, ide } = setup();

    const result = await tool.execute(preparedFor());

    expect(result).toStrictEqual({ kind: "updated", toolId: TOOL.claude, fileCount: 3 });
    expect(ide).not.toHaveBeenCalled();
    expect(runtime).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: TOOL.claude,
        projectRoot: PROJECT,
        version: "9.9.9",
        force: true,
        manifest,
        onBeforeWriteRegularFile: guard,
      })
    );
  });

  it("installs an IDE tool through the IDE installer", async () => {
    const { tool, runtime, ide } = setup();

    await tool.execute(preparedFor(TOOL.vscode));

    expect(runtime).not.toHaveBeenCalled();
    expect(ide).toHaveBeenCalledWith(expect.objectContaining({ toolId: TOOL.vscode }));
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

    expect(await tool.execute(preparedFor())).toStrictEqual({ kind: "skipped" });
  });

  it.each([
    ["an Error", new Error("disk full")],
    ["a plain string", "plain string"],
  ])("lets %s the installer rejected with travel", async (_n, rejection) => {
    const { tool } = setup({
      runtime: async () => {
        throw rejection;
      },
    });

    await expect(tool.execute(preparedFor())).rejects.toBe(rejection);
  });
});
