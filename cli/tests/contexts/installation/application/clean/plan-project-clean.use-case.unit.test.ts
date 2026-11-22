import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { PlanProjectClean } from "../../../../../src/contexts/installation/application/clean/plan-project-clean.use-case.js";
import type { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { RegistrationRecords } from "../../../../../src/contexts/installation/ports/record/registration-records.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

function planOver(
  manifest: Manifest | null,
  records: RegistrationRecords = new Map()
): PlanProjectClean {
  return new PlanProjectClean(
    {
      manifestRepo: new InMemoryManifestRepository(manifest, "/test-project", records),
      asks: { homeDir: () => "/home" },
    },
    registeredTools()
  );
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

describe("PlanProjectClean", () => {
  it("answers null when the project installed nothing", async () => {
    await expect(planOver(null).execute(registrationRecordRules)).resolves.toBeNull();
  });

  it("leaves a tool that is not an AI tool out of the user plugins it lists", async () => {
    const manifest = aManifest()
      .withTool(TOOL.vscode, [])
      .withPlugin(TOOL.vscode, localPlugin("ide-plugin", "user"))
      .build();

    const plan = await planOver(manifest).execute(registrationRecordRules);

    expect(plan?.userPlugins).toEqual([]);
  });

  it("keys a ref scope only for a plugin the host registered", async () => {
    const manifest = aManifest()
      .withTool(TOOL.codex, [])
      .withPlugin(TOOL.codex, localPlugin("unregistered"))
      .build();
    const records: RegistrationRecords = new Map([
      [
        TOOL.codex,
        {
          binary: "codex",
          marketplaces: [{ alias: "aidd", hostName: "aidd" }],
          pluginRefs: [],
        },
      ],
    ]);

    const plan = await planOver(manifest, records).execute(registrationRecordRules);

    expect(plan?.withdrawals.map((w) => w.refScopes.size)).toEqual([0]);
  });
});
