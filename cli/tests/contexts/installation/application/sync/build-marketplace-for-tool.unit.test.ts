import { describe, expect, it, vi } from "vitest";
import { BuildMarketplaceForTool } from "../../../../../src/contexts/installation/application/sync/build-marketplace-for-tool.js";
import type { DeclaredMarketplace } from "../../../../../src/contexts/installation/ports/marketplace-sources.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const MARKETPLACE: DeclaredMarketplace = {
  name: "aidd",
  source: { kind: "local", path: "/source" },
  scope: "project",
};
const ROOT = "/project";

function setup(ensureBuilt = fakeEnsureBuiltMarketplace()) {
  const logger = new CapturingLogger();
  const execute = vi.spyOn(ensureBuilt, "execute");
  const command = new BuildMarketplaceForTool(ensureBuilt, logger, registeredTools());
  return { command, execute, logger };
}

describe("BuildMarketplaceForTool.forTool", () => {
  it("builds nothing for a tool that is not an AI tool", async () => {
    const { command, execute } = setup();

    await expect(command.forTool(TOOL.vscode, MARKETPLACE, ROOT)).resolves.toBeNull();

    expect(execute).not.toHaveBeenCalled();
  });
});
