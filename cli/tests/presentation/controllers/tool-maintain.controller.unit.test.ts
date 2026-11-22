import { describe, expect, it, vi } from "vitest";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { toolConfigHarness } from "../../shared/testing/tool-config-command.builder.js";

const PROJECT_ROOT = process.cwd();
const CATALOG = registeredTools();
const { uninstallTools, updateTools, errors, pretendTerminal, run } = toolConfigHarness({
  tools: CATALOG,
  ideTool: TOOL.vscode,
  aiTool: TOOL.claude,
});

describe("aidd framework remove", () => {
  it("removes one AI tool, and counts every file that went", async () => {
    uninstallTools.mockResolvedValue([
      { toolId: TOOL.claude, fileCount: 4 },
      { toolId: TOOL.claude, fileCount: 3 },
    ]);

    expect(await run("remove", "--tool", "claude")).toEqual(["Removed claude (7 files removed)"]);
    expect(uninstallTools).toHaveBeenCalledWith({
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
    });
  });

  it("names a failed removal on stderr and fails the process", async () => {
    uninstallTools.mockRejectedValue(new Error("manifest is locked"));
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("remove", "--tool", "claude")).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: manifest is locked\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("removes an IDE tool through the same command", async () => {
    uninstallTools.mockResolvedValue([{ toolId: TOOL.vscode, fileCount: 1 }]);

    expect(await run("remove", "--tool", "vscode")).toEqual(["Removed vscode (1 files removed)"]);
    expect(uninstallTools).toHaveBeenCalledWith({
      toolIds: ["vscode"],
      projectRoot: PROJECT_ROOT,
    });
  });
});

describe("aidd framework update", () => {
  it("prints what the update moved and warns about what it could not", async () => {
    updateTools.mockResolvedValue({
      updatedTools: [
        { toolId: TOOL.claude, fileCount: 5 },
        { toolId: TOOL.vscode, fileCount: 2 },
      ],
      errors: [{ scope: "vscode", error: "one file was kept" }],
    });

    expect(await run("update")).toEqual(["Updated claude (5 files)", "Updated vscode (2 files)"]);
    expect(updateTools).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      userForce: false,
      interactive: false,
    });
    expect(errors.join("")).toBe("Warning: [vscode] one file was kept\n");
  });

  it("says nothing is installed when nothing moved and nothing failed", async () => {
    expect(await run("update")).toEqual(["No tools installed."]);
  });

  it("narrows the update to the tool named", async () => {
    await run("update", "--tool", "claude", "--force");

    expect(updateTools).toHaveBeenCalledWith({
      toolArg: "claude",
      projectRoot: PROJECT_ROOT,
      userForce: true,
      interactive: false,
    });
  });

  it("names a failed update on stderr and fails the process", async () => {
    updateTools.mockRejectedValue(new Error("bundled assets are missing"));
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("update")).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: bundled assets are missing\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("tells the update a terminal is watching", async () => {
    pretendTerminal(true);

    await run("update");

    expect(updateTools).toHaveBeenCalledWith(expect.objectContaining({ interactive: true }));
  });

  it("treats a stream that says nothing about being a terminal as none", async () => {
    Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });

    await run("update");

    expect(updateTools).toHaveBeenCalledWith(expect.objectContaining({ interactive: false }));
  });

  it("refuses a tool it does not know before asking the updater", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("update", "--tool", "nope")).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe(
      "Error: Unknown tool: nope. Valid tools: claude, cursor, copilot, opencode, kilo, codex, antigravity, vscode\n"
    );
    expect(updateTools).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
