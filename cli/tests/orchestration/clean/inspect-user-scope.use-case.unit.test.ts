import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { hostCatalog } from "../testing/synthetic-hosts.builder.js";
import { userScopeCleanerDeps } from "../testing/user-scope-cleaner.builder.js";

function inspectorOver(logger: CapturingLogger) {
  return userScopeCleanerDeps({
    tools: hostCatalog(),
    repo: new InMemoryManifestRepository(null),
    logger,
  }).inspect;
}

describe("inspecting the machine before a user-scope clean", () => {
  it("says no host registration was undone when there is no user manifest", async () => {
    const logger = new CapturingLogger();

    const inspected = await inspectorOver(logger).execute();

    expect(inspected.manifestFound).toBe(false);
    expect(logger.infoMessages).toStrictEqual([
      "No host registration was undone: nothing was registered at user scope.",
    ]);
  });

  it("asks which source goes, which versions it holds and who still references it", async () => {
    const inspected = await inspectorOver(new CapturingLogger()).execute();

    expect(inspected.question).toBe(
      `Remove the shared '${FRAMEWORK_MARKETPLACE_NAME}' source for this machine ` +
        "(versions: none built yet)? Still referenced by: no other project."
    );
  });
});
