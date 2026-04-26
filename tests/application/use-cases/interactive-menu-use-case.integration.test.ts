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
    it("groups commands by usage area", async () => {
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

    it("each group has a description to guide the user", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter, selectMock } = makeQueuedPrompter(["exit"]);

      await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();

      const choices = selectMock.mock.calls[0][1] as Array<{ value: string; description?: string }>;
      const groupsWithDescription = choices.filter((c) => c.value !== "exit" && c.description);
      expect(groupsWithDescription.length).toBe(4);
    });

    it("status is reachable from the inspect group", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["inspect", "status"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["status"]);
    });

    it("install is reachable from the manage tools group", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["manage-tools", "install"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.command).toEqual(["install"]);
    });

    it("update is reachable from the maintain group", async () => {
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

    describe("config submenu", () => {
      it("lists all settings", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter } = makeQueuedPrompter(["system", "config", "list"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["config", "list"]);
      });

      it("gets a specific setting by key", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter } = makeQueuedPrompter(["system", "config", "get", "docsDir"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["config", "get", "docsDir"]);
      });

      it("sets the docs directory with the entered value", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter } = makeQueuedPrompter(["system", "config", "set-docs"], ["my_docs"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["config", "set", "docsDir", "my_docs", "--force"]);
      });

      it("sets the repository with the entered value", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter } = makeQueuedPrompter(["system", "config", "set-repo"], ["owner/repo"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["config", "set", "repo", "owner/repo", "--force"]);
      });

      it("goes back to system group from config submenu", async () => {
        const deps = buildDeps(projectRoot);
        await initProject(deps, projectRoot);
        const { prompter, selectMock } = makeQueuedPrompter(["system", "config", "back", "exit"]);
        const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
        expect(result.command).toEqual(["exit"]);
        expect(selectMock).toHaveBeenCalledTimes(4);
      });
    });

    describe("cache submenu", () => {
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

    it("returns the breadcrumb path so the loop can resume at the right level", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["inspect", "status"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.returnTo).toEqual(["inspect"]);
    });

    it("returns the full breadcrumb for nested submenus", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      const { prompter } = makeQueuedPrompter(["system", "config", "list"]);
      const result = await new InteractiveMenuUseCase(deps.manifestRepo, prompter).execute();
      expect(result.returnTo).toEqual(["system", "config"]);
    });
  });
});
