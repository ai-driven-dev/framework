import { describe, expect, it, vi } from "vitest";
import type { ReportStatusResult } from "../../../src/contexts/installation/application/report-status.use-case.js";
import type {
  OpenRestore,
  RestoreGlobalResult,
} from "../../../src/contexts/installation/application/restore/project/restore-global.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RestoreAll } from "../../../src/orchestration/global/restore-all.use-case.js";
import { CheckboxRecordingPrompter } from "../../shared/testing/checkbox-recording-prompter.fake.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

const PROJECT = "/project";

const restored: RestoreGlobalResult = {
  totalRestored: 2,
  totalKept: 1,
  restoredPluginNames: ["alpha"],
  unrestorable: ["gone.md"],
  nativeOnlyToolIds: [SYNTHETIC_TOOL],
};

function drift(...entries: Array<[string, "modified" | "deleted" | "added"]>): ReportStatusResult {
  return {
    tools: [
      {
        toolId: SYNTHETIC_TOOL,
        version: "1",
        drifted: entries.map(([relativePath, status]) => ({ relativePath, status })),
      },
    ],
    pluginDrift: [],
    inSync: entries.length === 0,
  };
}

function build(options: {
  report?: ReportStatusResult;
  selection?: readonly string[];
  execute?: OpenRestore["execute"];
}) {
  const execute = vi.fn(options.execute ?? (async () => restored));
  const prompter = new CheckboxRecordingPrompter(options.selection);
  const reportStatus = { execute: vi.fn(async () => options.report ?? drift()) };
  const useCase = new RestoreAll(prompter, reportStatus, {
    open: async () => ({ manifest: Manifest.create(), execute }),
  });
  return { useCase, execute, prompter, reportStatus };
}

describe("RestoreAll", () => {
  it("restores everything and reports the counts when the run is not interactive", async () => {
    const { useCase, execute, reportStatus } = build({});

    const result = await useCase.execute(PROJECT, false, false);

    expect(result).toEqual({
      totalRestored: 2,
      totalKept: 1,
      pluginNamesRestored: ["alpha"],
      errors: [],
      failed: false,
      unrestorable: ["gone.md"],
      nativeOnlyToolIds: [SYNTHETIC_TOOL],
    });
    expect(execute).toHaveBeenCalledWith({
      projectRoot: PROJECT,
      files: undefined,
      force: false,
      interactive: false,
    });
    expect(reportStatus.execute).not.toHaveBeenCalled();
  });

  it("offers only the modified and deleted files and restores the ones chosen", async () => {
    const { useCase, execute, prompter } = build({
      report: drift(["a.md", "modified"], ["b.md", "deleted"], ["c.md", "added"]),
      selection: ["b.md"],
    });

    await useCase.execute(PROJECT, false, true);

    expect(prompter.asks[0].offered).toEqual(["a.md", "b.md"]);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ files: ["b.md"] }));
  });

  it("restores every drifted file without asking when nothing drifted", async () => {
    const { useCase, execute, prompter } = build({ report: drift(["c.md", "added"]) });

    await useCase.execute(PROJECT, false, true);

    expect(prompter.asks).toEqual([]);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ files: undefined }));
  });

  it("restores nothing when the user selects no file", async () => {
    const { useCase, execute } = build({
      report: drift(["a.md", "modified"]),
      selection: [],
    });

    const result = await useCase.execute(PROJECT, false, true);

    expect(execute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ totalRestored: 0, failed: false, errors: [] });
  });

  it("fails the run with the restore's message when the restore throws", async () => {
    const { useCase } = build({
      execute: async () => {
        throw new Error("disk full");
      },
    });

    const result = await useCase.execute(PROJECT, true, false);

    expect(result.failed).toBe(true);
    expect(result.errors).toEqual([{ scope: "config-restore", error: new Error("disk full") }]);
    expect(result.totalRestored).toBe(0);
  });
});
