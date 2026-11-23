import { describe, expect, it } from "vitest";
import { recordsOf } from "../../../../../src/composition/installation.js";
import { PlanProjectClean } from "../../../../../src/contexts/installation/application/clean/plan-project-clean.use-case.js";
import type { ToolRecords } from "../../../../../src/contexts/installation/contract/records/scope-records.js";
import type { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

function planOver(manifest: Manifest | null, records: ToolRecords = new Map()) {
  const manifestRepo = new InMemoryManifestRepository(manifest, "/test-project", records);
  const plan = new PlanProjectClean(
    { manifestRepo, asks: { homeDir: () => "/home" } },
    registeredTools()
  );
  return { execute: () => plan.execute(recordsOf(manifestRepo)) };
}

function localPlugin(name: string, scope: Scope = "project"): RecordedPlugin {
  return RecordedPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: { kind: "local", path: "/p" },
    strict: false,
    scope,
  });
}

describe("planning the clean of a project", () => {
  it("answers null when the project installed nothing", async () => {
    await expect(planOver(null).execute()).resolves.toBeNull();
  });

  it("leaves a tool that is not an AI tool out of the user plugins it lists", async () => {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, localPlugin("ide-plugin", "user"))
      .build();

    const plan = await planOver(manifest).execute();

    expect(plan?.userPlugins).toEqual([]);
  });

  it("keys a ref scope only for a plugin the host registered", async () => {
    const manifest = aManifest()
      .withTool(TOOL.codex, [])
      .withPlugin(TOOL.codex, localPlugin("unregistered"))
      .build();
    const records: ToolRecords = new Map([
      [
        TOOL.codex,
        {
          binary: "codex",
          marketplaces: [{ alias: "aidd", hostName: "aidd" }],
          pluginRefs: [],
        },
      ],
    ]);

    const plan = await planOver(manifest, records).execute();

    expect(plan?.withdrawals.map((w) => w.refScopes.size)).toEqual([0]);
  });
});
