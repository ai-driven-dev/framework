import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { UpdateToolRequest } from "../../../../../src/contexts/installation/application/update/update-tool.use-case.js";
import { InputRequiredError } from "../../../../../src/shared/domain/shared.error.js";
import {
  buildInstallationDeps,
  buildUpdateTool,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

function commandOf(overwriteModified: UpdateToolRequest["overwriteModified"]): UpdateToolRequest {
  return {
    toolId: TOOL.claude,
    projectRoot: PROJECT_ROOT,
    version: "test",
    overwriteModified,
  };
}

async function installWithModifiedFile(): Promise<{ deps: Deps; relativePath: string }> {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  const first = (await deps.manifestRepo.load())?.getToolFiles(TOOL.claude)[0];
  if (!first) throw new Error("the installed tool tracks no file");
  await deps.fs.writeFile(join(PROJECT_ROOT, first.relativePath), "user-modified content");
  return { deps, relativePath: first.relativePath };
}

describe("UpdateTool integration", () => {
  it("writes an unmodified file without asking", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const ask = vi.fn();

    const result = await buildUpdateTool(deps).execute(commandOf(ask));

    expect(result.kind).toBe("updated");
    expect(ask).not.toHaveBeenCalled();
  });

  it("writes back a tracked file the user deleted, without asking", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const first = (await deps.manifestRepo.load())?.getToolFiles(TOOL.claude)[0];
    if (!first) throw new Error("the installed tool tracks no file");
    await deps.fs.deleteFile(join(PROJECT_ROOT, first.relativePath));
    const ask = vi.fn();

    const result = await buildUpdateTool(deps).execute(commandOf(ask));

    expect(result.kind).toBe("updated");
    expect(ask).not.toHaveBeenCalled();
    expect(deps.fs.getFile(join(PROJECT_ROOT, first.relativePath))).toBeDefined();
  });

  it("overwrites a modified file the answer says to overwrite", async () => {
    const { deps, relativePath } = await installWithModifiedFile();
    const ask = vi.fn().mockResolvedValue(true);

    const result = await buildUpdateTool(deps).execute(commandOf(ask));

    expect(result.kind).toBe("updated");
    expect(ask).toHaveBeenCalledWith(relativePath);
    expect(await deps.fs.readFile(join(PROJECT_ROOT, relativePath))).not.toBe(
      "user-modified content"
    );
  });

  it("keeps a modified file the answer says to keep", async () => {
    const { deps, relativePath } = await installWithModifiedFile();

    await buildUpdateTool(deps).execute(commandOf(vi.fn().mockResolvedValue(false)));

    expect(await deps.fs.readFile(join(PROJECT_ROOT, relativePath))).toBe("user-modified content");
  });

  it("lets an InputRequiredError from the question stop the run", async () => {
    const { deps } = await installWithModifiedFile();
    const ask = vi.fn().mockRejectedValue(new InputRequiredError("use --force"));

    await expect(buildUpdateTool(deps).execute(commandOf(ask))).rejects.toThrow(InputRequiredError);
  });

  it("answers skipped when the installer skipped the tool", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    vi.spyOn(deps.installRuntimeConfigUseCase, "execute").mockResolvedValue({
      toolId: TOOL.claude,
      fileCount: 0,
      files: [],
      skipped: true,
      warnings: [],
    });

    expect(await buildUpdateTool(deps).execute(commandOf(vi.fn()))).toStrictEqual({
      kind: "skipped",
    });
  });

  it.each([
    ["an Error", new Error("disk full")],
    ["a plain string", "plain string"],
  ])("answers failed with %s the installer rejected with", async (_name, rejection) => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    vi.spyOn(deps.installRuntimeConfigUseCase, "execute").mockRejectedValue(rejection);

    expect(await buildUpdateTool(deps).execute(commandOf(vi.fn()))).toStrictEqual({
      kind: "failed",
      error: rejection,
    });
  });
});
