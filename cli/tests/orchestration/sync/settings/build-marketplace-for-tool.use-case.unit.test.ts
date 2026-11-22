import { describe, expect, it, vi } from "vitest";
import type { MarketplaceToBuild } from "../../../../src/contexts/installation/contract/built-marketplace.js";
import { BuildMarketplaceForTool } from "../../../../src/orchestration/sync/settings/build-marketplace-for-tool.use-case.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import {
  SYNTHETIC_IDE_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const MARKETPLACE: MarketplaceToBuild = {
  name: "aidd",
  source: { kind: "local", path: "/source" },
  scope: "project",
};
const ROOT = "/project";

function setup(ensureBuilt = fakeEnsureBuiltMarketplace()) {
  const logger = new CapturingLogger();
  const execute = vi.spyOn(ensureBuilt, "execute");
  const command = new BuildMarketplaceForTool(ensureBuilt, logger, syntheticMixedCatalog());
  return { command, execute, logger };
}

describe("building a marketplace for a tool", () => {
  it("builds nothing for a tool that is not an AI tool", async () => {
    const { command, execute } = setup();

    await expect(command.forTool(SYNTHETIC_IDE_TOOL, MARKETPLACE, ROOT)).resolves.toBeNull();

    expect(execute).not.toHaveBeenCalled();
  });
});
