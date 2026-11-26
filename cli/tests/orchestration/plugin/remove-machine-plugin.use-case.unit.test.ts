import { describe, expect, it } from "vitest";
import type { RemoveUserPluginRequest } from "../../../src/contexts/installation/application/removal/remove-user-plugin.use-case.js";
import { PluginNotFoundError } from "../../../src/contexts/installation/contract/installation.error.js";
import { RemoveMachinePlugin } from "../../../src/orchestration/plugin/remove-machine-plugin.use-case.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

describe("removing a machine plugin", () => {
  it("hands the command and the host registration's claimed ref rules to the user-scope removal", async () => {
    const records = {
      isQualifiedRef: () => false,
      refSelectedBy: () => true,
      claimsOf: () => [],
      holdersOf: () => [],
      pluginClaimsOf: () => [],
      withoutClaimedRef: <R>(record: R) => ({ ...record, pluginClaims: [] }),
      loadRecords: async () => new Map(),
      saveRecords: async () => undefined,
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

describe("removing a machine plugin a host's own server also holds", () => {
  const COMMAND = {
    pluginName: "aidd-dev",
    toolIds: "all",
    projectRoot: "/A",
    home: "/H",
  } as const;
  const NO_RECORDS = {
    isQualifiedRef: () => false,
    refSelectedBy: () => true,
    claimsOf: () => [],
    holdersOf: () => [],
    pluginClaimsOf: () => [],
    withoutClaimedRef: <R>(record: R) => ({ ...record, pluginClaims: [] }),
    loadRecords: async () => new Map(),
    saveRecords: async () => undefined,
  };

  function setup(files: () => Promise<void>, removed: ToolId[] = [SYNTHETIC_TOOL]) {
    const asked: unknown[] = [];
    const servers = {
      execute: async (request: unknown) => {
        asked.push(request);
        return new Map(removed.map((toolId) => [toolId, ["aidd-dev"]]));
      },
    };
    return { asked, remove: new RemoveMachinePlugin({ execute: files }, NO_RECORDS, servers) };
  }

  it("removes it from the host's server too, once the files are gone", async () => {
    const { remove, asked } = setup(async () => undefined);

    await remove.execute(COMMAND);

    expect(asked).toEqual([{ plugin: "aidd-dev", toolIds: "all" }]);
  });

  it("removes it from the server when only the server held it", async () => {
    const { remove, asked } = setup(async () => {
      throw new PluginNotFoundError("aidd-dev");
    });

    await remove.execute(COMMAND);

    expect(asked).toHaveLength(1);
  });

  it("still reports a plugin no one holds as not found", async () => {
    const { remove } = setup(async () => {
      throw new PluginNotFoundError("aidd-dev");
    }, []);

    await expect(remove.execute(COMMAND)).rejects.toThrow(PluginNotFoundError);
  });

  it("leaves the server alone when the files' removal is refused", async () => {
    const { remove, asked } = setup(async () => {
      throw new Error("a project depends on it");
    });

    await expect(remove.execute(COMMAND)).rejects.toThrow("a project depends on it");
    expect(asked).toEqual([]);
  });
});
