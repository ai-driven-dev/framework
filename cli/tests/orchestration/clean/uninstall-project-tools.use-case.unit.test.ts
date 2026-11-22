import { describe, expect, it } from "vitest";
import type { UninstallToolsRequest } from "../../../src/contexts/installation/application/uninstall-tools.use-case.js";
import { UninstallProjectTools } from "../../../src/orchestration/clean/uninstall-project-tools.use-case.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

describe("UninstallProjectTools", () => {
  it("hands the command and the host registration's ref reading to the tool removal", async () => {
    const records = { pluginRefsOf: () => [] };
    const asked: UninstallToolsRequest[] = [];
    const removed = [{ toolId: TOOL.claude, fileCount: 0, deletedFiles: [] }];
    const uninstall = new UninstallProjectTools(
      {
        execute: async (request) => {
          asked.push(request);
          return removed;
        },
      },
      records
    );

    await expect(uninstall.execute({ toolIds: [TOOL.claude], projectRoot: "/A" })).resolves.toBe(
      removed
    );

    expect(asked).toStrictEqual([{ toolIds: [TOOL.claude], projectRoot: "/A", records }]);
    expect(asked[0]?.records).toBe(records);
  });
});
