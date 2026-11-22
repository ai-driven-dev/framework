import { describe, expect, it, vi } from "vitest";
import { ExitRequested } from "../../../shared/testing/capturing-output.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";
import { toolConfigHarness } from "../../../shared/testing/tool-config-command.builder.js";

const PROJECT_ROOT = process.cwd();
const CATALOG = syntheticMixedCatalog();
const { uninstallTools, updateTools, errors, pretendTerminal, run } = toolConfigHarness({
  tools: CATALOG,
  ideTool: SYNTHETIC_IDE_TOOL,
  aiTool: SYNTHETIC_TOOL,
});

describe("aidd framework remove", () => {
  it("removes one AI tool, and counts every file that went", async () => {
    uninstallTools.mockResolvedValue([
      { toolId: SYNTHETIC_TOOL, fileCount: 4 },
      { toolId: SYNTHETIC_TOOL, fileCount: 3 },
    ]);

    expect(await run("remove", "--tool", SYNTHETIC_TOOL)).toEqual([
      `Removed ${SYNTHETIC_TOOL} (7 files removed)`,
    ]);
    expect(uninstallTools).toHaveBeenCalledWith({
      toolIds: [SYNTHETIC_TOOL],
      projectRoot: PROJECT_ROOT,
    });
  });

  it("names a failed removal on stderr and fails the process", async () => {
    uninstallTools.mockRejectedValue(new Error("manifest is locked"));
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("remove", "--tool", SYNTHETIC_TOOL)).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: manifest is locked\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("removes an IDE tool through the same command", async () => {
    uninstallTools.mockResolvedValue([{ toolId: SYNTHETIC_IDE_TOOL, fileCount: 1 }]);

    expect(await run("remove", "--tool", SYNTHETIC_IDE_TOOL)).toEqual([
      `Removed ${SYNTHETIC_IDE_TOOL} (1 files removed)`,
    ]);
    expect(uninstallTools).toHaveBeenCalledWith({
      toolIds: [SYNTHETIC_IDE_TOOL],
      projectRoot: PROJECT_ROOT,
    });
  });
});

describe("aidd framework update", () => {
  it("prints what the update moved and warns about what it could not", async () => {
    updateTools.mockResolvedValue({
      updatedTools: [
        { toolId: SYNTHETIC_TOOL, fileCount: 5 },
        { toolId: SYNTHETIC_IDE_TOOL, fileCount: 2 },
      ],
      errors: [{ scope: SYNTHETIC_IDE_TOOL, error: "one file was kept" }],
    });

    expect(await run("update")).toEqual([
      `Updated ${SYNTHETIC_TOOL} (5 files)`,
      `Updated ${SYNTHETIC_IDE_TOOL} (2 files)`,
    ]);
    expect(updateTools).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      userForce: false,
      interactive: false,
    });
    expect(errors.join("")).toBe(`Warning: [${SYNTHETIC_IDE_TOOL}] one file was kept\n`);
  });

  it("says nothing is installed when nothing moved and nothing failed", async () => {
    expect(await run("update")).toEqual(["No tools installed."]);
  });

  it("narrows the update to the tool named", async () => {
    await run("update", "--tool", SYNTHETIC_TOOL, "--force");

    expect(updateTools).toHaveBeenCalledWith({
      toolArg: SYNTHETIC_TOOL,
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
      `Error: Unknown tool: nope. Valid tools: ${SYNTHETIC_TOOL}, ${SECOND_SYNTHETIC_TOOL}, ${SYNTHETIC_IDE_TOOL}\n`
    );
    expect(updateTools).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
