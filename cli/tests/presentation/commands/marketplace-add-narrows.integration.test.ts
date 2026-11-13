// `marketplace add <name>` re-drives native activation narrowed to the marketplace it just
// registered; `marketplace remove | refresh` deliberately keep the bare, unnarrowed call.
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import type { DepsFactory, MenuDepsFactory } from "../../../src/presentation/deps.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";
import { asDepsFactory, asMenuDepsFactory } from "../../helpers/fake-deps.js";

const marketplaceSyncExecute = vi
  .fn()
  .mockResolvedValue({ activated: [], binaryMissing: [], warnings: [], errors: [] });
const marketplaceAddExecute = vi.fn().mockResolvedValue({ marketplace: { name: "market-b" } });

const createDeps = vi.fn(async () => ({
  marketplaceAddUseCase: { execute: marketplaceAddExecute },
  marketplaceSyncSettingsUseCase: { execute: marketplaceSyncExecute },
  prompter: { input: vi.fn() },
}));
const createMenuDeps = vi.fn(() => ({ prompter: { input: vi.fn(), select: vi.fn() } }));
const depsFactory = asDepsFactory(createDeps);
const menuDepsFactory = asMenuDepsFactory(createMenuDeps);

const { registerMarketplaceCommand } = await import(
  "../../../src/presentation/commands/marketplace.js"
);

describe("marketplace add narrows native activation to the marketplace it just registered", () => {
  it("passes marketplaceNames: [name] to MarketplaceSyncSettingsUseCase.execute", async () => {
    const program = new Command();
    program.exitOverride();
    registerMarketplaceCommand(program, catalogOf(), depsFactory, menuDepsFactory);

    await program.parseAsync(["node", "aidd", "marketplace", "add", "market-b", "/some/source"]);

    expect(marketplaceSyncExecute).toHaveBeenCalledWith(
      expect.objectContaining({ marketplaceNames: ["market-b"] })
    );
  });
});
