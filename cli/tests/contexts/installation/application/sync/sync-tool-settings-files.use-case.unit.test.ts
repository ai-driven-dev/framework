import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { BuildMarketplaceForTool } from "../../../../../src/contexts/installation/application/sync/build-marketplace-for-tool.use-case.js";
import { SyncToolSettingsFiles } from "../../../../../src/contexts/installation/application/sync/sync-tool-settings-files.use-case.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const { claude } = TOOL;
const ROOT = "/project";
const SETTINGS =
  registeredTools().aiProfileIfAny(claude)?.marketplaceRegistration()?.sharedSettingsFile() ?? "";

describe("SyncToolSettingsFiles project-tools", () => {
  it("warns and starts from nothing when the settings file holds malformed JSON", async () => {
    const path = resolve(ROOT, SETTINGS);
    const logger = new CapturingLogger();
    const sync = new SyncToolSettingsFiles(
      {
        fs: new InMemoryFileAdapter({ [path]: '{"enabledPlugins": {},}' }),
        logger,
        buildMarketplace: new BuildMarketplaceForTool(
          fakeEnsureBuiltMarketplace(),
          logger,
          registeredTools()
        ),
        records: registrationRecordRules,
      },
      registeredTools()
    );

    await sync.execute({
      kind: "project-tools",
      projectRoot: ROOT,
      manifest: aManifest().withTool(claude, []).build(),
      marketplaces: [],
      toolIds: [claude],
    });

    expect(logger.warnMessages).toContain(
      `Ignoring malformed JSON in ${path}; rewriting the keys this CLI owns.`
    );
  });
});
