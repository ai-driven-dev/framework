// `marketplace add <name>` re-drives native activation narrowed to the marketplace it just
// registered; `marketplace remove | refresh` deliberately keep the bare, unnarrowed call.
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";
import { prompterAnswering } from "../../helpers/ports/partial-ports.js";

const marketplaceSyncExecute = vi
  .fn()
  .mockResolvedValue({ activated: [], binaryMissing: [], warnings: [], errors: [] });
const marketplaceAddExecute = vi.fn().mockResolvedValue({ marketplace: { name: "market-b" } });

const createDeps = vi.fn(async () => ({
  addMarketplace: { execute: marketplaceAddExecute },
  listMarketplaces: { execute: vi.fn() },
  marketplaceRemoveUseCase: { execute: vi.fn() },
  userMarketplaceRemoveUseCase: { execute: vi.fn() },
  refreshMarketplace: { execute: vi.fn() },
  marketplaceCheckUseCase: { execute: vi.fn() },
  marketplaceSyncSettingsUseCase: { execute: marketplaceSyncExecute },
  prompter: prompterAnswering({ input: vi.fn() }),
}));
const createMenuDeps = vi.fn(() => ({
  prompter: prompterAnswering({ input: vi.fn(), select: vi.fn() }),
}));

const { registerMarketplaceCommand } = await import(
  "../../../src/presentation/commands/marketplace.js"
);

describe("marketplace add narrows native activation to the marketplace it just registered", () => {
  it("passes marketplaceNames: [name] to MarketplaceSyncSettingsUseCase.execute", async () => {
    const program = new Command();
    program.exitOverride();
    registerMarketplaceCommand(program, catalogOf(), createDeps, createMenuDeps);

    await program.parseAsync(["node", "aidd", "marketplace", "add", "market-b", "/some/source"]);

    expect(marketplaceSyncExecute).toHaveBeenCalledWith(
      expect.objectContaining({ marketplaceNames: ["market-b"] })
    );
  });
});
