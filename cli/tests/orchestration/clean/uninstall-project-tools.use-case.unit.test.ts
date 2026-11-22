import { describe, expect, it } from "vitest";
import type { UninstallToolsRequest } from "../../../src/contexts/installation/application/uninstall-tools.use-case.js";
import { UninstallProjectTools } from "../../../src/orchestration/clean/uninstall-project-tools.use-case.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

describe("UninstallProjectTools", () => {
  it("hands the command and the host registration's ref reading to the tool removal", async () => {
    const records = { pluginRefsOf: () => [] };
    const asked: UninstallToolsRequest[] = [];
    const removed = [{ toolId: SYNTHETIC_TOOL, fileCount: 0, deletedFiles: [] }];
    const uninstall = new UninstallProjectTools(
      {
        execute: async (request) => {
          asked.push(request);
          return removed;
        },
      },
      records
    );

    await expect(uninstall.execute({ toolIds: [SYNTHETIC_TOOL], projectRoot: "/A" })).resolves.toBe(
      removed
    );

    expect(asked).toStrictEqual([{ toolIds: [SYNTHETIC_TOOL], projectRoot: "/A", records }]);
    expect(asked[0]?.records).toBe(records);
  });
});
