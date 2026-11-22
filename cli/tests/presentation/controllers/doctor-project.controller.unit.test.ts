import { describe, expect, it, vi } from "vitest";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { doctorHarness, HEALTHY_SCOPE } from "../../shared/testing/doctor-command.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
} from "../../shared/testing/synthetic-tool-id.builder.js";

const PROJECT_ROOT = process.cwd();
const { doctorAll, statusAll, doctorScoped, statusScoped, written, errors, run } = doctorHarness();

describe("aidd doctor - every tool at once", () => {
  it("reports drift for both categories, then calls a clean install healthy", async () => {
    expect(await run()).toEqual([
      "",
      "Drift:",
      "AI tools:",
      "  (none installed)",
      "IDE tools:",
      "  (none installed)",
      "Plugins:",
      "  (all in sync)",
      "",
      "Installation is healthy",
    ]);
    expect(doctorAll).toHaveBeenCalledWith(PROJECT_ROOT, undefined);
    expect(statusAll).toHaveBeenCalledWith(PROJECT_ROOT);
  });

  it("names each equipped tool with its version and what it carries", async () => {
    doctorAll.mockResolvedValue({
      errors: [],
      ai: {
        toolHealth: [{ toolId: SYNTHETIC_TOOL, fileCount: 12, mergeFileCount: 1 }],
        issues: [],
      },
      ide: HEALTHY_SCOPE,
      pluginIssues: [],
      healthy: true,
    });
    statusAll.mockResolvedValue({
      aiTools: { tools: [{ toolId: SYNTHETIC_TOOL, version: "5.2.2", drifted: [] }] },
      ideTools: { tools: [] },
      pluginDrift: [],
    });

    expect(await run()).toEqual([
      "",
      "AI tools:",
      `  ${SYNTHETIC_TOOL} (v5.2.2): 12 files, 1 merge files`,
      "",
      "Drift:",
      "AI tools:",
      `  ${SYNTHETIC_TOOL} (v5.2.2): in sync`,
      "IDE tools:",
      "  (none installed)",
      "Plugins:",
      "  (all in sync)",
      "",
      "Installation is healthy",
    ]);
  });

  it("surfaces the report's own errors before anything it could measure", async () => {
    doctorAll.mockResolvedValue({
      errors: [{ scope: "claude", error: "settings.json is unreadable" }],
      ai: HEALTHY_SCOPE,
      ide: HEALTHY_SCOPE,
      pluginIssues: [],
      healthy: true,
    });

    await run();

    expect(errors.join("")).toBe("Warning: [claude] settings.json is unreadable\n");
  });

  it("fails the process on an unhealthy install rather than calling it healthy", async () => {
    doctorAll.mockResolvedValue({
      errors: [],
      ai: {
        toolHealth: [],
        issues: [
          {
            severity: "error",
            message: "claude is not registered",
            fix: { code: "sync-reregister" },
          },
        ],
      },
      ide: HEALTHY_SCOPE,
      pluginIssues: [],
      healthy: false,
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run()).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe(
      "Error:   claude is not registered\n    Fix: Run `aidd sync` to re-register it.\n"
    );
    expect(written.join("")).not.toContain("healthy");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("holds scope issues back for a named plugin and ends on the scenario's verdict", async () => {
    doctorAll.mockResolvedValue({
      errors: [],
      ai: {
        toolHealth: [],
        issues: [
          {
            severity: "error",
            message: "claude is not registered",
            fix: { code: "sync-reregister" },
          },
        ],
      },
      ide: HEALTHY_SCOPE,
      pluginIssues: [],
      healthy: true,
    });

    const lines = await run("--plugin", "aidd-dev");

    expect(doctorAll).toHaveBeenCalledWith(PROJECT_ROOT, "aidd-dev");
    expect(errors.join("")).toBe("");
    expect(lines[lines.length - 1]).toBe("Installation is healthy");
  });

  it("fails when the named plugin is the thing that is broken", async () => {
    doctorAll.mockResolvedValue({
      errors: [],
      ai: HEALTHY_SCOPE,
      ide: HEALTHY_SCOPE,
      pluginIssues: [
        {
          pluginName: "aidd-dev",
          toolId: SYNTHETIC_TOOL,
          issue: "drifted",
          filePath: ".claude/a.md",
        },
      ],
      healthy: false,
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--plugin", "aidd-dev")).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe(
      `Error:   Plugin aidd-dev (${SYNTHETIC_TOOL}): drifted — .claude/a.md\n    Fix: Run \`aidd sync\`\n`
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("aidd doctor - the two categories, told apart", () => {
  it("labels each category's inventory and its issues by that category's own name", async () => {
    doctorAll.mockResolvedValue({
      errors: [],
      ai: {
        toolHealth: [{ toolId: SYNTHETIC_TOOL, fileCount: 1, mergeFileCount: 0 }],
        issues: [
          {
            severity: "info",
            message: "claude has never run",
            fix: "The plugin does not load until claude's own CLI has run and answered this.",
          },
        ],
      },
      ide: {
        toolHealth: [{ toolId: SYNTHETIC_IDE_TOOL, fileCount: 2, mergeFileCount: 0 }],
        issues: [
          {
            severity: "info",
            message: "vscode has never run",
            fix: "The plugin does not load until vscode's own CLI has run and answered this.",
          },
        ],
      },
      pluginIssues: [],
      healthy: true,
    });

    expect(await run()).toEqual([
      "",
      "AI tools:",
      `  ${SYNTHETIC_TOOL} (vunknown): 1 files, 0 merge files`,
      "",
      "IDE tools:",
      `  ${SYNTHETIC_IDE_TOOL} (vunknown): 2 files, 0 merge files`,
      "",
      "Drift:",
      "AI tools:",
      "  (none installed)",
      "IDE tools:",
      "  (none installed)",
      "Plugins:",
      "  (all in sync)",
      "",
      "AI:",
      "",
      "IDE:",
      "",
      "Installation is healthy",
    ]);
    expect(errors.join("")).toBe(
      "Warning:   claude has never run\n    Fix: The plugin does not load until claude's own CLI has run and answered this.\n" +
        "Warning:   vscode has never run\n    Fix: The plugin does not load until vscode's own CLI has run and answered this.\n"
    );
  });
});

describe("aidd doctor --tool", () => {
  it("asks the category the tool belongs to, then narrows the inventory to that tool", async () => {
    doctorScoped.mockResolvedValue({
      toolHealth: [
        { toolId: SYNTHETIC_TOOL, fileCount: 12, mergeFileCount: 1 },
        { toolId: SECOND_SYNTHETIC_TOOL, fileCount: 9, mergeFileCount: 0 },
      ],
      issues: [],
      pluginIssues: [],
      healthy: true,
    });
    statusScoped.mockResolvedValue({
      tools: [{ toolId: SYNTHETIC_TOOL, version: "5.2.2", drifted: [] }],
      pluginDrift: [],
    });

    expect(await run("--tool", SYNTHETIC_TOOL)).toEqual([
      "",
      `${SYNTHETIC_TOOL} tools:`,
      `  ${SYNTHETIC_TOOL} (v5.2.2): 12 files, 1 merge files`,
      "",
      "Drift:",
      `  ${SYNTHETIC_TOOL} (v5.2.2): in sync`,
      "Plugins:",
      "  (all in sync)",
      "",
      "Installation is healthy",
    ]);
    expect(doctorScoped).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      category: "ai",
      pluginName: undefined,
    });
    expect(statusScoped).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      filterToolId: SYNTHETIC_TOOL,
      pluginName: undefined,
    });
    expect(doctorAll).not.toHaveBeenCalled();
  });

  it("calls an IDE tool an IDE tool when it asks its category", async () => {
    await run("--tool", SYNTHETIC_IDE_TOOL);

    expect(doctorScoped).toHaveBeenCalledWith(expect.objectContaining({ category: "ide" }));
  });

  it("reads a tool no profile declares as an editor, and still asks for it", async () => {
    await run("--tool", "nope");

    expect(doctorScoped).toHaveBeenCalledWith(expect.objectContaining({ category: "ide" }));
    expect(statusScoped).toHaveBeenCalledWith(expect.objectContaining({ filterToolId: "nope" }));
  });

  it("carries the named plugin into both reads", async () => {
    await run("--tool", SYNTHETIC_TOOL, "--plugin", "aidd-dev");

    expect(doctorScoped).toHaveBeenCalledWith(expect.objectContaining({ pluginName: "aidd-dev" }));
    expect(statusScoped).toHaveBeenCalledWith(expect.objectContaining({ pluginName: "aidd-dev" }));
  });

  it("names that tool's own scope issues when no plugin narrows the run", async () => {
    doctorScoped.mockResolvedValue({
      toolHealth: [],
      issues: [
        {
          severity: "error",
          message: "claude is not registered",
          fix: { code: "sync-reregister" },
        },
      ],
      pluginIssues: [],
      healthy: false,
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--tool", SYNTHETIC_TOOL)).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe(
      "Error:   claude is not registered\n    Fix: Run `aidd sync` to re-register it.\n"
    );
  });

  it("fails the process when that one tool's category is unhealthy", async () => {
    doctorScoped.mockResolvedValue({
      toolHealth: [],
      issues: [],
      pluginIssues: [],
      healthy: false,
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--tool", SYNTHETIC_TOOL)).rejects.toThrow(ExitRequested);

    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("aidd doctor --tool with a plugin named", () => {
  it("holds that tool's scope issues back, and gates on the plugin alone", async () => {
    doctorScoped.mockResolvedValue({
      toolHealth: [],
      issues: [
        {
          severity: "error",
          message: "claude is not registered",
          fix: { code: "sync-reregister" },
        },
      ],
      pluginIssues: [],
      healthy: false,
    });

    const lines = await run("--tool", SYNTHETIC_TOOL, "--plugin", "aidd-dev");

    expect(errors.join("")).toBe("");
    expect(lines[lines.length - 1]).toBe("Installation is healthy");
  });

  it("fails when that one plugin is the thing that is broken", async () => {
    doctorScoped.mockResolvedValue({
      toolHealth: [],
      issues: [],
      pluginIssues: [
        { pluginName: "aidd-dev", toolId: SYNTHETIC_TOOL, issue: "not-installed-on-machine" },
      ],
      healthy: true,
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--tool", SYNTHETIC_TOOL, "--plugin", "aidd-dev")).rejects.toThrow(
      ExitRequested
    );

    expect(errors[0]).toBe(
      `Error:   ${SYNTHETIC_TOOL}: plugins not installed on this machine, run \`aidd sync\`\n`
    );
  });
});
