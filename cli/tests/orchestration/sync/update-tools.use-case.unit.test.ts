import { describe, expect, it, vi } from "vitest";
import { ListInstalledTools } from "../../../src/contexts/installation/application/list-installed-tools.use-case.js";
import type { Prompter } from "../../../src/orchestration/ports/prompter.js";
import { ResolveUpdateDecision } from "../../../src/orchestration/sync/resolve-update-decision.use-case.js";
import { UpdateTools } from "../../../src/orchestration/sync/update-tools.use-case.js";
import { InputRequiredError } from "../../../src/shared/domain/shared.error.js";
import {
  buildInstallationDeps,
  buildToolUpdate,
  initProject,
  installTool,
} from "../../shared/testing/installation-deps.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

const CURRENT_VERSION = "0.0.0-test";

const PROJECT_ROOT = "/test-project";

const NO_FORCE_NO_TTY = { userForce: false, interactive: false };

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

function promptingWith(answer: "overwrite-all"): { prompter: Prompter; asked: () => number } {
  const resolveConflictBulk = vi.fn().mockResolvedValue(answer);
  const prompter: Prompter = {
    resolveConflict: vi.fn(),
    resolveConflictBulk,
    confirm: vi.fn(),
    input: vi.fn(),
    select: vi.fn(),
    checkbox: vi.fn(),
  };
  return { prompter, asked: () => resolveConflictBulk.mock.calls.length };
}

function build(deps: Deps, prompter: Prompter = promptingWith("overwrite-all").prompter) {
  const { prepare, update: updateTool } = buildToolUpdate(deps);
  const useCase = new UpdateTools({
    listInstalledTools: new ListInstalledTools(deps.manifestRepo, syntheticMixedCatalog()),
    prepareToolUpdate: prepare,
    updateTool,
    resolveUpdateDecision: new ResolveUpdateDecision(prompter),
    version: CURRENT_VERSION,
  });
  return { useCase, updateTool };
}

async function installed(...toolIds: Parameters<typeof installTool>[2][]): Promise<Deps> {
  const deps = await buildInstallationDeps({ tools: syntheticMixedCatalog() });
  await initProject(deps, PROJECT_ROOT);
  for (const toolId of toolIds) await installTool(deps, PROJECT_ROOT, toolId);
  return deps;
}

describe("updating tools", () => {
  it("returns an empty result when nothing is installed", async () => {
    const { useCase } = build(await buildInstallationDeps({ tools: syntheticMixedCatalog() }));

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result).toStrictEqual({ updatedTools: [], errors: [] });
  });

  it("updates every installed tool, the AI ones before the IDE ones", async () => {
    const deps = await installed(SYNTHETIC_IDE_TOOL, SYNTHETIC_TOOL);

    const result = await build(deps).useCase.execute({
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result.updatedTools.map((t) => t.toolId)).toStrictEqual([
      SYNTHETIC_TOOL,
      SYNTHETIC_IDE_TOOL,
    ]);
    expect(result.errors).toStrictEqual([]);
  });

  it.each([SYNTHETIC_TOOL, SYNTHETIC_IDE_TOOL])(
    "updates only %s when it is the one named",
    async (toolArg) => {
      const deps = await installed(SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL, SYNTHETIC_IDE_TOOL);

      const result = await build(deps).useCase.execute({
        toolArg,
        projectRoot: PROJECT_ROOT,
        ...NO_FORCE_NO_TTY,
      });

      expect(result.updatedTools.map((t) => t.toolId)).toStrictEqual([toolArg]);
    }
  );

  it("reports the tool that failed under its own scope and updates the others", async () => {
    const deps = await installed(SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL);
    const { useCase, updateTool } = build(deps);
    vi.spyOn(updateTool, "execute").mockImplementation(async ({ command: { toolId } }) => {
      if (toolId === SECOND_SYNTHETIC_TOOL)
        throw new Error(`${SECOND_SYNTHETIC_TOOL} update failed`);
      return { kind: "updated", toolId, fileCount: 3 };
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result.updatedTools).toStrictEqual([{ toolId: SYNTHETIC_TOOL, fileCount: 3 }]);
    expect(result.errors).toStrictEqual([
      { scope: SECOND_SYNTHETIC_TOOL, error: new Error(`${SECOND_SYNTHETIC_TOOL} update failed`) },
    ]);
  });

  it("reports a rejection that is no Error as it came", async () => {
    const { useCase, updateTool } = build(await installed(SYNTHETIC_TOOL));
    vi.spyOn(updateTool, "execute").mockRejectedValue("plain string");

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT, ...NO_FORCE_NO_TTY });

    expect(result.errors).toStrictEqual([{ scope: SYNTHETIC_TOOL, error: "plain string" }]);
  });

  it("stops the whole batch when a tool needs a question nobody can answer", async () => {
    const { useCase, updateTool } = build(await installed(SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL));
    const update = vi
      .spyOn(updateTool, "execute")
      .mockRejectedValue(new InputRequiredError("use --force"));

    await expect(
      useCase.execute({ projectRoot: PROJECT_ROOT, ...NO_FORCE_NO_TTY })
    ).rejects.toThrow(InputRequiredError);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("stops the batch, reporting no tool, when the manifest it updates against cannot be read", async () => {
    const deps = await installed(SYNTHETIC_TOOL);
    const { useCase } = build(deps);
    vi.spyOn(deps.manifestRepo, "load").mockRejectedValue(new Error("manifest corrupted"));

    await expect(
      useCase.execute({ toolArg: SYNTHETIC_TOOL, projectRoot: PROJECT_ROOT, ...NO_FORCE_NO_TTY })
    ).rejects.toThrow("manifest corrupted");
  });

  it("stops the run, updating no tool, when the installed tools cannot be listed", async () => {
    const deps = await installed(SYNTHETIC_TOOL, SYNTHETIC_IDE_TOOL);
    const listInstalledTools = new ListInstalledTools(deps.manifestRepo, syntheticMixedCatalog());
    const list = listInstalledTools.execute.bind(listInstalledTools);
    vi.spyOn(listInstalledTools, "execute").mockImplementation(async (query) => {
      if (query.category === "ai") throw new Error("ai list failed");
      return list(query);
    });
    const { prepare, update: updateTool } = buildToolUpdate(deps);
    const update = vi.spyOn(updateTool, "execute");
    const useCase = new UpdateTools({
      listInstalledTools,
      prepareToolUpdate: prepare,
      updateTool,
      resolveUpdateDecision: new ResolveUpdateDecision(promptingWith("overwrite-all").prompter),
      version: CURRENT_VERSION,
    });

    await expect(
      useCase.execute({ projectRoot: PROJECT_ROOT, ...NO_FORCE_NO_TTY })
    ).rejects.toThrow("ai list failed");
    expect(update).not.toHaveBeenCalled();
  });

  it("reports neither an update nor an error for a tool the update skipped", async () => {
    const deps = await installed(SYNTHETIC_TOOL);
    const { useCase, updateTool } = build(deps);
    vi.spyOn(updateTool, "execute").mockResolvedValue({ kind: "skipped" });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result).toStrictEqual({ updatedTools: [], errors: [] });
  });

  it("asks once for 'overwrite all' and not again for the next tool", async () => {
    const deps = await installed(SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL);
    const loaded = await deps.manifestRepo.load();
    const modified: string[] = [];
    for (const toolId of [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL]) {
      const first = loaded?.getToolFiles(toolId)[0];
      if (first === undefined) throw new Error(`${toolId} installed no file to modify`);
      const path = `${PROJECT_ROOT}/${first.relativePath}`;
      await deps.fs.writeFile(path, "user-modified");
      modified.push(path);
    }
    const { prompter, asked } = promptingWith("overwrite-all");

    const result = await build(deps, prompter).useCase.execute({
      projectRoot: PROJECT_ROOT,
      userForce: false,
      interactive: true,
    });

    expect(asked()).toBe(1);
    expect(result.updatedTools.map((t) => t.toolId)).toStrictEqual([
      SYNTHETIC_TOOL,
      SECOND_SYNTHETIC_TOOL,
    ]);
    for (const path of modified) expect(await deps.fs.readFile(path)).not.toBe("user-modified");
  });
});
