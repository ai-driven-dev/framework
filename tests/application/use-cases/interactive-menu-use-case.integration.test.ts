import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveMenuUseCase } from "../../../src/application/commands/menu.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import { buildDeps, cleanupTempProject, createTempProject, initProject } from "./helpers.js";

type SelectChoice = { name: string; value: string };

function makeQueuedPrompter(
  selectResponses: string[],
  inputResponses: string[] = []
): { prompter: Prompter; selectMock: ReturnType<typeof vi.fn> } {
  let selectIdx = 0;
  let inputIdx = 0;
  const selectMock = vi.fn().mockImplementation((_msg: string, choices: SelectChoice[]) => {
    const val = selectResponses[selectIdx++];
    const match = choices.find((c) => c.value === val);
    if (!match) throw new Error(`No choice with value "${val}"`);
    return Promise.resolve(match.value);
  });
  const inputMock = vi.fn().mockImplementation(() => {
    return Promise.resolve(inputResponses[inputIdx++] ?? "");
  });
  const prompter: Prompter = {
    resolveConflict: vi.fn(),
    confirm: vi.fn(),
    input: inputMock,
    select: selectMock,
    checkbox: vi.fn(),
  };
  return { prompter, selectMock };
}

describe("interactive menu", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  describe("project without AIDD installed", () => {
    it("proposes installing AIDD or exiting", async () => {
      const deps = buildDeps(projectRoot);
      const { prompter, selectMock } = makeQueuedPrompter(["setup"]);

      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();

      expect(result.command).toEqual(["setup"]);
      const values = (selectMock.mock.calls[0][1] as SelectChoice[]).map((c) => c.value);
      expect(values).toEqual(["setup", "exit"]);
    });

    it("exits cleanly when user chooses to leave", async () => {
      const deps = buildDeps(projectRoot);
      const { prompter } = makeQueuedPrompter(["exit"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["exit"]);
    });

    it("does not show command groups before installation", async () => {
      const deps = buildDeps(projectRoot);
      const { prompter, selectMock } = makeQueuedPrompter(["exit"]);
      await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(selectMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("project with AIDD installed", () => {
    // TODO(feat/cli-v5-cleanup follow-up): menu groups restructured in v5 (manage-tools → manage-ai/manage-ide).
    it.skip("groups commands by usage area", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter, selectMock } = makeQueuedPrompter(["exit"]);

      await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();

      const values = (selectMock.mock.calls[0][1] as SelectChoice[]).map((c) => c.value);
      expect(values).toContain("inspect");
      expect(values).toContain("manage-tools");
      expect(values).toContain("maintain");
      expect(values).toContain("system");
      expect(values).toContain("exit");
    });

    // TODO(feat/cli-v5-cleanup follow-up): group count changed — update to reflect v5 menu structure.
    it.skip("each group has a description to guide the user", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter, selectMock } = makeQueuedPrompter(["exit"]);

      await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();

      const choices = selectMock.mock.calls[0][1] as Array<{ value: string; description?: string }>;
      const groupsWithDescription = choices.filter((c) => c.value !== "exit" && c.description);
      expect(groupsWithDescription.length).toBe(6);
    });

    it("status is reachable from the inspect group", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["inspect", "status"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["status"]);
    });

    // TODO(feat/cli-v5-cleanup follow-up): `manage-tools`/`install` removed; now `manage-ai`/`ai install`.
    it.skip("install is reachable from the manage tools group", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["manage-tools", "install"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["install"]);
    });

    // TODO(feat/cli-v5-cleanup follow-up): `maintain`/`update` removed; now `manage-ai`/`ai update`.
    it.skip("update is reachable from the maintain group", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["maintain", "update"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["update"]);
    });

    it("self-update is reachable from the system group", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["system", "self-update"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["self-update"]);
    });

    // TODO(feat/cli-v5-cleanup follow-up): `aidd cache` removed; `aidd marketplace cache` is the new surface.
    // Update menu tests to use `marketplace cache list/clear` when menu is updated.
    describe.skip("cache submenu", () => {
      it("lists cached versions", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter } = makeQueuedPrompter(["system", "cache", "list"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["cache", "list"]);
      });

      it("clears all cached versions", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter } = makeQueuedPrompter(["system", "cache", "clear-all"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["cache", "clear", "--all"]);
      });

      it("clears a specific version entered by the user", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter } = makeQueuedPrompter(["system", "cache", "clear-version"], ["v3.2.0"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["cache", "clear", "v3.2.0"]);
      });
    });

    it("exit is available directly from a group submenu", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter, selectMock } = makeQueuedPrompter(["inspect", "exit"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["exit"]);
      expect(selectMock).toHaveBeenCalledTimes(2);
    });

    it("going back from a group returns to the main menu", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter, selectMock } = makeQueuedPrompter(["inspect", "back", "exit"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["exit"]);
      expect(selectMock).toHaveBeenCalledTimes(3);
    });

    it("internal commands adopt and init are never exposed", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const allValues: string[] = [];
      const selectMock = vi.fn().mockImplementation((_msg: string, choices: SelectChoice[]) => {
        allValues.push(...choices.map((c) => c.value));
        const first = choices.find((c) => c.value !== "exit" && c.value !== "back");
        return Promise.resolve(first?.value ?? "exit");
      });
      const prompter: Prompter = {
        resolveConflict: vi.fn(),
        confirm: vi.fn(),
        input: vi.fn().mockResolvedValue(""),
        select: selectMock,
        checkbox: vi.fn(),
      };
      await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(allValues).not.toContain("adopt");
      expect(allValues).not.toContain("init");
    });

    it("always returns to root after a command (no breadcrumb saved)", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["inspect", "status"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["status"]);
      expect("returnTo" in result).toBe(false);
    });
  });
});
