import { describe, expect, it, vi } from "vitest";
import { BuildMenu } from "../../../src/orchestration/menu/build-menu.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import { makeQueuedPrompter, setUp } from "../testing/queued-menu-prompter.builder.js";

const TOOL_PROMPT =
  "Tool (e.g. claude, cursor, copilot, codex, opencode, kilo, antigravity, vscode)";

describe("interactive menu", () => {
  describe("project without AIDD installed", () => {
    it("prompts to run setup when the project is not set up and the user confirms", async () => {
      const confirmMock = vi.fn().mockResolvedValue(true);
      const prompter: Prompter = {
        resolveConflict: vi.fn(),
        resolveConflictBulk: vi.fn(),
        confirm: confirmMock,
        input: vi.fn(),
        select: vi.fn(),
        checkbox: vi.fn(),
      };

      const result = await new BuildMenu(setUp(false), prompter, catalogOf()).execute();

      expect(result.command).toEqual(["setup"]);
      expect(confirmMock).toHaveBeenCalledWith("AIDD not initialized. Run setup now?", true);
    });

    it("exits when the project is not set up and the user declines setup", async () => {
      const prompter: Prompter = {
        resolveConflict: vi.fn(),
        resolveConflictBulk: vi.fn(),
        confirm: vi.fn().mockResolvedValue(false),
        input: vi.fn(),
        select: vi.fn(),
        checkbox: vi.fn(),
      };

      const result = await new BuildMenu(setUp(false), prompter, catalogOf()).execute();

      expect(result.command).toEqual(["exit"]);
    });

    it("does not show the full menu before installation", async () => {
      const selectMock = vi.fn();
      const prompter: Prompter = {
        resolveConflict: vi.fn(),
        resolveConflictBulk: vi.fn(),
        confirm: vi.fn().mockResolvedValue(false),
        input: vi.fn(),
        select: selectMock,
        checkbox: vi.fn(),
      };
      await new BuildMenu(setUp(false), prompter, catalogOf()).execute();
      expect(selectMock).not.toHaveBeenCalled();
    });
  });

  describe("project with AIDD installed", () => {
    it("groups commands by usage area", async () => {
      const { prompter, selectCalls } = makeQueuedPrompter(["exit"]);

      await new BuildMenu(setUp(true), prompter, catalogOf()).execute();

      const values = selectCalls[0][1].map((c) => c.value);
      expect(values).toContain("inspect");
      expect(values).toContain("manage-tools");
      expect(values).toContain("manage-plugins");
      expect(values).toContain("marketplaces");
      expect(values).toContain("maintain");
      expect(values).toContain("system");
      expect(values).toContain("exit");
    });

    it("each group has a description to guide the user", async () => {
      const { prompter, selectCalls } = makeQueuedPrompter(["exit"]);

      await new BuildMenu(setUp(true), prompter, catalogOf()).execute();

      const choices = selectCalls[0][1];
      const groupsWithDescription = choices.filter((c) => c.value !== "exit" && c.description);
      expect(groupsWithDescription.length).toBe(6);
    });

    it("doctor is reachable from the inspect group", async () => {
      const { prompter } = makeQueuedPrompter(["inspect", "doctor"]);
      const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(result.command).toEqual(["doctor"]);
    });

    it("framework install is reachable from the manage-tools group", async () => {
      const { prompter } = makeQueuedPrompter(["manage-tools", "framework-install"], ["claude"]);
      const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(result.command).toEqual(["framework", "install", "--tool", "claude"]);
    });

    it("framework update (all) is reachable from the maintain group", async () => {
      const { prompter } = makeQueuedPrompter(["maintain", "framework-update-maintain"]);
      const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(result.command).toEqual(["framework", "update"]);
    });

    it("CLI update is reachable from the system group", async () => {
      const { prompter } = makeQueuedPrompter(["system", "self-update"]);
      const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(result.command).toEqual(["update"]);
    });

    it("exit is available directly from a group submenu", async () => {
      const { prompter, selectCalls } = makeQueuedPrompter(["inspect", "exit"]);
      const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(result.command).toEqual(["exit"]);
      expect(selectCalls).toHaveLength(2);
    });

    it("going back from a group returns to the main menu", async () => {
      const { prompter, selectCalls } = makeQueuedPrompter(["inspect", "back", "exit"]);
      const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(result.command).toEqual(["exit"]);
      expect(selectCalls).toHaveLength(3);
    });

    it("internal commands adopt and init are never exposed", async () => {
      const allValues: string[] = [];
      const select: Prompter["select"] = async (_msg, choices) => {
        allValues.push(...choices.map((c) => String(c.value)));
        const first = choices.find((c) => c.value !== "exit" && c.value !== "back") ?? choices[0];
        return first.value;
      };
      const prompter: Prompter = {
        resolveConflict: vi.fn(),
        resolveConflictBulk: vi.fn(),
        confirm: vi.fn(),
        input: vi.fn().mockResolvedValue(""),
        select,
        checkbox: vi.fn(),
      };
      await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(allValues).not.toContain("adopt");
      expect(allValues).not.toContain("init");
    });

    it("always returns to root after a command (no breadcrumb saved)", async () => {
      const { prompter } = makeQueuedPrompter(["inspect", "doctor"]);
      const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();
      expect(result.command).toEqual(["doctor"]);
      expect("returnTo" in result).toBe(false);
    });
  });
});

describe("interactive menu — the command each pick hands over", () => {
  async function commandFor(path: string[], input?: string): Promise<string[]> {
    const { prompter } = makeQueuedPrompter(path, input === undefined ? [] : [input]);

    const result = await new BuildMenu(setUp(true), prompter, catalogOf()).execute();

    return result.command;
  }

  it.each([
    [["inspect", "doctor"], ["doctor"]],
    [
      ["inspect", "plugin-list"],
      ["plugin", "list"],
    ],
    [
      ["manage-tools", "framework-update-all"],
      ["framework", "update"],
    ],
    [
      ["manage-plugins", "plugin-update"],
      ["plugin", "update"],
    ],
    [
      ["manage-plugins", "plugin-list-2"],
      ["plugin", "list"],
    ],
    [
      ["marketplaces", "marketplace-list"],
      ["marketplace", "list"],
    ],
    [
      ["marketplaces", "marketplace-add"],
      ["marketplace", "add"],
    ],
    [
      ["marketplaces", "marketplace-refresh"],
      ["marketplace", "refresh"],
    ],
    [
      ["marketplaces", "marketplace-check"],
      ["marketplace", "check"],
    ],
    [
      ["maintain", "framework-update-maintain"],
      ["framework", "update"],
    ],
    [["maintain", "sync-all"], ["sync"]],
    [["maintain", "clean"], ["clean"]],
    [["system", "self-update"], ["update"]],
    [
      ["system", "auth", "auth-status"],
      ["auth", "status"],
    ],
    [
      ["system", "auth", "auth-login"],
      ["auth", "login"],
    ],
    [
      ["system", "auth", "auth-logout"],
      ["auth", "logout"],
    ],
  ])("hands %j over as %j, asking nothing", async (path, command) => {
    expect(await commandFor(path)).toEqual(command);
  });

  it.each([
    [["inspect", "doctor-tool"], "claude", ["doctor", "--tool", "claude"]],
    [["manage-tools", "framework-install"], "cursor", ["framework", "install", "--tool", "cursor"]],
    [["manage-tools", "framework-remove"], "codex", ["framework", "remove", "--tool", "codex"]],
    [
      ["manage-tools", "framework-update-one"],
      "vscode",
      ["framework", "update", "--tool", "vscode"],
    ],
    [["manage-plugins", "plugin-install"], "aidd-dev", ["plugin", "install", "aidd-dev"]],
    [["manage-plugins", "plugin-search"], "review", ["plugin", "search", "review"]],
    [["manage-plugins", "plugin-remove"], "aidd-dev", ["plugin", "remove", "aidd-dev"]],
    [["manage-plugins", "plugin-doctor"], "aidd-dev", ["doctor", "--plugin", "aidd-dev"]],
    [
      ["marketplaces", "marketplace-remove"],
      "aidd-framework",
      ["marketplace", "remove", "aidd-framework"],
    ],
  ])("hands %j over with what it asked for, as %j", async (path, answer, command) => {
    expect(await commandFor(path, answer)).toEqual(command);
  });

  it.each([
    [["inspect", "doctor-tool"], TOOL_PROMPT],
    [["manage-tools", "framework-install"], TOOL_PROMPT],
    [["manage-tools", "framework-remove"], "Tool to remove"],
    [["manage-tools", "framework-update-one"], "Tool to update"],
    [
      ["manage-plugins", "plugin-install"],
      "Plugin name, path, or leave empty for interactive pick",
    ],
    [["manage-plugins", "plugin-search"], "Search query"],
    [["manage-plugins", "plugin-remove"], "Plugin name to remove"],
    [["manage-plugins", "plugin-doctor"], "Plugin name"],
    [["marketplaces", "marketplace-remove"], "Marketplace name to remove"],
  ])("asks %j for its argument by name: %s", async (path, question) => {
    const { prompter, inputMock } = makeQueuedPrompter(path, ["x"]);

    await new BuildMenu(setUp(true), prompter, catalogOf()).execute();

    expect(inputMock).toHaveBeenCalledWith(question);
  });
});
