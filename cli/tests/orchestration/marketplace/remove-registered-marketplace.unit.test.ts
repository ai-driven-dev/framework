import { describe, expect, it } from "vitest";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { RemoveRegisteredMarketplace } from "../../../src/orchestration/marketplace/remove-registered-marketplace.js";
import { InvalidMarketplaceNameError } from "../../../src/shared/domain/errors.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";

const PROJECT_ROOT = "/test-project";
const OUTCOME = { marketplace: { name: "awesome" }, removedPluginCount: 0, orphanCount: 0 };

async function removalOf(registeredScope: Scope | undefined) {
  const removed: string[] = [];
  const registry = new InMemoryMarketplaceRegistry();
  if (registeredScope !== undefined) {
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: "/marketplace" },
        scope: registeredScope,
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
  }
  const removal = new RemoveRegisteredMarketplace(
    new ListMarketplaces(registry),
    {
      execute: async (command) => {
        removed.push(`project:${command.scope}`);
        return OUTCOME;
      },
    },
    {
      execute: async (command) => {
        removed.push(`user:${command.scope}`);
        return OUTCOME;
      },
    }
  );
  return { removal, removed };
}

describe("RemoveRegisteredMarketplace", () => {
  it.each(["user", "project"] as const)(
    "removes a %s-scope entry through that scope's scenario",
    async (scope) => {
      const { removal, removed } = await removalOf(scope);

      await removal.execute({ name: "awesome", projectRoot: PROJECT_ROOT });

      expect(removed).toEqual([`${scope}:${scope}`]);
    }
  );

  it("removes nothing when the name is not registered", async () => {
    const { removal, removed } = await removalOf(undefined);

    await removal.execute({ name: "awesome", projectRoot: PROJECT_ROOT });

    expect(removed).toEqual([]);
  });

  it("refuses the framework's reserved name", async () => {
    const { removal } = await removalOf("project");

    await expect(
      removal.execute({ name: FRAMEWORK_MARKETPLACE_NAME, projectRoot: PROJECT_ROOT })
    ).rejects.toBeInstanceOf(InvalidMarketplaceNameError);
  });
});
