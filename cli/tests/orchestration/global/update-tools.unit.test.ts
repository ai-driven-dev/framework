import { describe, expect, it, vi } from "vitest";
import { ListInstalledTools } from "../../../src/contexts/installation/application/list-installed-tools.js";
import { ResolveUpdateDecision } from "../../../src/orchestration/global/resolve-update-decision.js";
import { UpdateTools } from "../../../src/orchestration/global/update-tools.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";
import {
  buildUnitDeps,
  buildUpdateTool,
  initProject,
  installTool,
} from "../../helpers/ports/build-unit-deps.js";
import { TOOL } from "../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/test-project";

const NO_FORCE_NO_TTY = { userForce: false, interactive: false };

type Deps = Awaited<ReturnType<typeof buildUnitDeps>>;

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
  const updateTool = buildUpdateTool(deps);
  const useCase = new UpdateTools(
    new ListInstalledTools(deps.manifestRepo, catalogOf()),
    updateTool,
    new ResolveUpdateDecision(prompter),
    deps.currentVersionProvider
  );
  return { useCase, updateTool };
}

async function installed(...toolIds: Parameters<typeof installTool>[2][]): Promise<Deps> {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initProject(deps, PROJECT_ROOT);
  for (const toolId of toolIds) await installTool(deps, PROJECT_ROOT, toolId);
  return deps;
}

describe("UpdateTools", () => {
  it("returns an empty result when nothing is installed", async () => {
    const { useCase } = build(await buildUnitDeps(PROJECT_ROOT));

    const result = await useCase.execute({
      tools: catalogOf(),
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result).toStrictEqual({ updatedTools: [], errors: [] });
  });

  it("updates every installed tool, the AI ones before the IDE ones", async () => {
    const deps = await installed(TOOL.vscode, TOOL.claude);

    const result = await build(deps).useCase.execute({
      tools: catalogOf(),
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result.updatedTools.map((t) => t.toolId)).toStrictEqual(["claude", "vscode"]);
    expect(result.errors).toStrictEqual([]);
  });

  it.each([TOOL.claude, TOOL.vscode])(
    "updates only %s when it is the one named",
    async (toolArg) => {
      const deps = await installed(TOOL.claude, TOOL.cursor, TOOL.vscode);

      const result = await build(deps).useCase.execute({
        tools: catalogOf(),
        toolArg,
        projectRoot: PROJECT_ROOT,
        ...NO_FORCE_NO_TTY,
      });

      expect(result.updatedTools.map((t) => t.toolId)).toStrictEqual([toolArg]);
    }
  );

  it("reports the tool that failed under its own scope and updates the others", async () => {
    const deps = await installed(TOOL.claude, TOOL.cursor);
    const { useCase, updateTool } = build(deps);
    vi.spyOn(updateTool, "execute").mockImplementation(async ({ toolId }) =>
      toolId === "cursor"
        ? { kind: "failed", message: "cursor update failed" }
        : { kind: "updated", toolId, fileCount: 3 }
    );

    const result = await useCase.execute({
      tools: catalogOf(),
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result.updatedTools).toStrictEqual([{ toolId: "claude", fileCount: 3 }]);
    expect(result.errors).toStrictEqual([{ scope: "cursor", message: "cursor update failed" }]);
  });

  it("reports neither an update nor an error for a tool the update skipped", async () => {
    const deps = await installed(TOOL.claude);
    const { useCase, updateTool } = build(deps);
    vi.spyOn(updateTool, "execute").mockResolvedValue({ kind: "skipped" });

    const result = await useCase.execute({
      tools: catalogOf(),
      projectRoot: PROJECT_ROOT,
      ...NO_FORCE_NO_TTY,
    });

    expect(result).toStrictEqual({ updatedTools: [], errors: [] });
  });

  it("asks once for 'overwrite all' and not again for the next tool", async () => {
    const deps = await installed(TOOL.claude, TOOL.cursor);
    const loaded = await deps.manifestRepo.load();
    for (const toolId of [TOOL.claude, TOOL.cursor]) {
      const first = loaded?.getToolFiles(toolId)[0];
      if (first) await deps.fs.writeFile(`${PROJECT_ROOT}/${first.relativePath}`, "user-modified");
    }
    const { prompter, asked } = promptingWith("overwrite-all");

    await build(deps, prompter).useCase.execute({
      tools: catalogOf(),
      projectRoot: PROJECT_ROOT,
      userForce: false,
      interactive: true,
    });

    expect(asked()).toBe(1);
  });
});
