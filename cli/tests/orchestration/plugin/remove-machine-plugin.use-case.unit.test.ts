import { describe, expect, it } from "vitest";
import type { RemoveUserPluginRequest } from "../../../src/contexts/installation/application/removal/remove-user-plugin.use-case.js";
import { RemoveMachinePlugin } from "../../../src/orchestration/plugin/remove-machine-plugin.use-case.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

describe("RemoveMachinePlugin", () => {
  it("hands the command and the host registration's claimed ref rules to the user-scope removal", async () => {
    const records = {
      isQualifiedRef: () => false,
      refSelectedBy: () => true,
      claimsOf: () => [],
      dependentsOf: () => [],
      withoutClaimedRef: <R>(record: R) => ({ ...record, pluginClaims: [] }),
    };
    const asked: RemoveUserPluginRequest[] = [];
    const remove = new RemoveMachinePlugin(
      {
        execute: async (request) => {
          asked.push(request);
        },
      },
      records
    );
    const command = { pluginName: "p", toolIds: [SYNTHETIC_TOOL], projectRoot: "/A", home: "/H" };

    await remove.execute(command);

    expect(asked).toStrictEqual([{ ...command, records }]);
    expect(asked[0]?.records).toBe(records);
  });
});
