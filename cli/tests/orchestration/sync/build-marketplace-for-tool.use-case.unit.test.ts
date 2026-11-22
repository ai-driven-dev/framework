import { describe, expect, it, vi } from "vitest";
import type { MarketplaceToBuild } from "../../../src/contexts/installation/contract/built-marketplace.js";
import { BuildMarketplaceForTool } from "../../../src/orchestration/sync/build-marketplace-for-tool.use-case.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import {
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

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

describe("BuildMarketplaceForTool.forTool", () => {
  it("builds nothing for a tool that is not an AI tool", async () => {
    const { command, execute } = setup();

    await expect(command.forTool(SYNTHETIC_IDE_TOOL, MARKETPLACE, ROOT)).resolves.toBeNull();

    expect(execute).not.toHaveBeenCalled();
  });
});

describe("BuildMarketplaceForTool when the build fails", () => {
  const refused = new Error("translator refused the source");
  const failing = () => ({ execute: vi.fn().mockRejectedValue(refused) });

  it("warns naming the marketplace and the tool, and answers null", async () => {
    const { command, logger } = setup(failing());

    await expect(command.forTool(SYNTHETIC_TOOL, MARKETPLACE, ROOT)).resolves.toBeNull();

    expect(logger.warnMessages).toStrictEqual([
      "Native plugin activation — build 'aidd' for synthetic skipped: Error: translator refused the source",
    ]);
  });

  it("does the same when asked for the tree directly", async () => {
    const { command } = setup(failing());

    await expect(command.execute(SYNTHETIC_TOOL, MARKETPLACE, ROOT)).resolves.toBeNull();
  });
});
