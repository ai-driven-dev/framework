// `marketplace add <name>` re-drives native activation narrowed to the marketplace it just
// registered; `marketplace remove | refresh` deliberately keep the bare, unnarrowed call.
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

import { prompterAnswering } from "../../shared/testing/partial-ports.builder.js";

const marketplaceSyncExecute = vi
  .fn()
  .mockResolvedValue({ activated: [], binaryMissing: [], warnings: [], errors: [], failed: false });
const marketplaceAddExecute = vi.fn().mockResolvedValue({ marketplace: { name: "market-b" } });

const createDeps = vi.fn(async () => ({
  addMarketplace: { execute: marketplaceAddExecute },
  listMarketplaces: { execute: vi.fn() },
  marketplaceRemoveUseCase: { execute: vi.fn() },
  userMarketplaceRemoveUseCase: { execute: vi.fn() },
  refreshMarketplace: { execute: vi.fn() },
  marketplaceCheckUseCase: { execute: vi.fn() },
  syncNativeActivation: { execute: marketplaceSyncExecute },
  prompter: prompterAnswering({ input: vi.fn() }),
}));

const { registerMarketplaceCommand } = await import(
  "../../../src/presentation/commands/marketplace.js"
);

describe("marketplace add narrows native activation to the marketplace it just registered", () => {
  it("passes marketplaceNames: [name] to SyncSettings.execute", async () => {
    const program = new Command();
    program.exitOverride();
    registerMarketplaceCommand(program, createDeps, vi.fn());

    await program.parseAsync(["node", "aidd", "marketplace", "add", "market-b", "/some/source"]);

    expect(marketplaceSyncExecute).toHaveBeenCalledWith(
      expect.objectContaining({ marketplaceNames: ["market-b"] })
    );
  });
});
