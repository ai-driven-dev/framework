import { describe, expect, it } from "vitest";
import { ReadMachineInstallation } from "../../../src/contexts/installation/application/doctor/read-machine-installation.use-case.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import {
  SyncFailedError,
  UserScopeFilterUnsupportedError,
} from "../../../src/orchestration/orchestration.error.js";
import { RunUserScopeSync } from "../../../src/orchestration/sync/run-user-scope-sync.use-case.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import { manifestRepositoryLoading } from "../../shared/testing/partial-ports.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { ACTIVATED_NOTHING } from "../testing/run-sync.builder.js";

const GIVEN = { projectRoot: "/p", files: [] };

function aRun(failed = false) {
  const calls: string[] = [];
  const refreshes: unknown[] = [];
  const syncs: unknown[] = [];
  const machine = aManifest()
    .withTool(TOOL.claude, [])
    .withPlugin(
      TOOL.claude,
      InstalledPlugin.fromMetadata({
        name: "aidd-dev",
        version: "1.0.0",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        strict: true,
        scope: "user",
      })
    )
    .build();
  const useCase = new RunUserScopeSync(
    {
      machine: new ReadMachineInstallation(manifestRepositoryLoading(async () => machine)),
      userPlugins: {
        execute: async (command) => {
          calls.push("refresh");
          refreshes.push(command);
          return ["aidd-dev"];
        },
      },
      syncSettings: {
        execute: async (command) => {
          calls.push("syncSettings");
          syncs.push(command);
          return failed
            ? { ...ACTIVATED_NOTHING, errors: [{ scope: "claude", error: "x" }], failed: true }
            : { ...ACTIVATED_NOTHING, activated: [TOOL.claude] };
        },
      },
    },
    catalogOf()
  );
  const report = {
    activated: () => calls.push("report activated"),
    synced: () => calls.push("report synced"),
  };
  return { useCase, report, calls, refreshes, syncs };
}

describe("RunUserScopeSync", () => {
  it.each([
    [
      { ...GIVEN, plugin: "aidd-dev" },
      new UserScopeFilterUnsupportedError("--plugin", "sync --plugin <name>"),
    ],
    [
      { ...GIVEN, files: ["a.md"] },
      new UserScopeFilterUnsupportedError("a file argument", "sync <files...>"),
    ],
  ])(
    "refuses a filter that has no user-scope counterpart before doing anything",
    async (command, error) => {
      const run = aRun();

      await expect(run.useCase.execute(command, run.report)).rejects.toThrow(error);
      expect(run.calls).toEqual([]);
    }
  );

  it("refreshes the files of each tool with user plugins, activates, then reports", async () => {
    const run = aRun();

    await run.useCase.execute(GIVEN, run.report);

    expect(run.calls).toEqual(["refresh", "syncSettings", "report activated", "report synced"]);
    expect(run.refreshes).toEqual([
      { toolIds: [TOOL.claude], projectRoot: "/p", scope: "user", rebuild: true },
    ]);
  });

  it("throws after reporting the activation, and reports no sync, when the activation failed", async () => {
    const run = aRun(true);

    await expect(run.useCase.execute(GIVEN, run.report)).rejects.toThrow(
      new SyncFailedError([{ scope: "claude", error: "x" }])
    );
    expect(run.calls.at(-1)).toBe("report activated");
  });
});
