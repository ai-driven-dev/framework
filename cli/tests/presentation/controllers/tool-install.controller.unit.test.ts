import { describe, expect, it, vi } from "vitest";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import { toolConfigHarness } from "../../shared/testing/tool-config-command.builder.js";

const PROJECT_ROOT = process.cwd();
const CATALOG = syntheticMixedCatalog();
const { installAiTool, installIdeTool, errors, run } = toolConfigHarness({
  tools: CATALOG,
  ideTool: SYNTHETIC_IDE_TOOL,
  aiTool: SYNTHETIC_TOOL,
});

describe("aidd framework install", () => {
  it("installs an AI tool at the version the graph reports, plugins carried along", async () => {
    expect(await run("install", "--tool", SYNTHETIC_TOOL)).toEqual([
      `Installed ${SYNTHETIC_TOOL} (5 files)`,
    ]);
    expect(installAiTool).toHaveBeenCalledWith({
      toolId: SYNTHETIC_TOOL,
      projectRoot: PROJECT_ROOT,
      force: false,
      version: "5.2.2",
      propagatePlugins: true,
    });
    expect(installIdeTool).not.toHaveBeenCalled();
  });

  it("leaves the already-installed alone, and names the flag that would redo it", async () => {
    installAiTool.mockResolvedValue({
      runtimeResult: { skipped: true, fileCount: 0, warnings: [] },
      propagationWarnings: [],
    });

    expect(await run("install", "--tool", SYNTHETIC_TOOL)).toEqual([]);
    expect(errors.join("")).toBe(
      `Warning: ${SYNTHETIC_TOOL} is already installed. Use \`--force\` to reinstall.\n`
    );
  });

  it("prints the runtime's own warnings before the propagation's, then the count", async () => {
    installAiTool.mockResolvedValue({
      runtimeResult: { skipped: false, fileCount: 5, warnings: ["merged settings.json"] },
      propagationWarnings: [{ text: "aidd-dev was not propagated" }],
    });

    expect(await run("install", "--tool", SYNTHETIC_TOOL)).toEqual([
      `Installed ${SYNTHETIC_TOOL} (5 files)`,
    ]);
    expect(errors.join("")).toBe(
      "Warning: merged settings.json\nWarning: aidd-dev was not propagated\n"
    );
  });

  it("carries an overwrite and a refused propagation through", async () => {
    await run("install", "--tool", SYNTHETIC_TOOL, "--force", "--no-plugins");

    expect(installAiTool).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, propagatePlugins: false })
    );
  });

  it("reports the activation an install already drove, and fails on a refusal", async () => {
    installAiTool.mockResolvedValue({
      runtimeResult: { skipped: false, fileCount: 5, warnings: [] },
      propagationWarnings: [],
      activation: {
        errors: [{ scope: SYNTHETIC_TOOL, error: `${SYNTHETIC_TOOL} CLI refused` }],
        failed: true,
      },
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("install", "--tool", SYNTHETIC_TOOL)).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe(
      `Warning: [${SYNTHETIC_TOOL}] ${SYNTHETIC_TOOL} CLI refused\nError: Sync failed for: ${SYNTHETIC_TOOL}. See the warnings above.\n`
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("sends an IDE tool down its own install", async () => {
    expect(await run("install", "--tool", SYNTHETIC_IDE_TOOL)).toEqual([
      `Installed ${SYNTHETIC_IDE_TOOL} (2 files)`,
    ]);
    expect(installIdeTool).toHaveBeenCalledWith({
      toolId: SYNTHETIC_IDE_TOOL,
      projectRoot: PROJECT_ROOT,
      force: false,
      version: "5.2.2",
    });
    expect(installAiTool).not.toHaveBeenCalled();
  });

  it("leaves an already-installed IDE tool alone too", async () => {
    installIdeTool.mockResolvedValue({
      skipped: true,
      toolId: SYNTHETIC_IDE_TOOL,
      fileCount: 0,
      warnings: [],
    });

    expect(await run("install", "--tool", SYNTHETIC_IDE_TOOL)).toEqual([]);
    expect(errors.join("")).toBe(
      `Warning: ${SYNTHETIC_IDE_TOOL} is already installed. Use \`--force\` to reinstall.\n`
    );
  });

  it("refuses a tool neither category declares, and lists every one it would have taken", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("install", "--tool", "emacs")).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe(
      `Error: Unknown tool: emacs. Valid tools: ${SYNTHETIC_TOOL}, ${SECOND_SYNTHETIC_TOOL}, ${SYNTHETIC_IDE_TOOL}\n`
    );
    expect(installAiTool).not.toHaveBeenCalled();
  });
});
