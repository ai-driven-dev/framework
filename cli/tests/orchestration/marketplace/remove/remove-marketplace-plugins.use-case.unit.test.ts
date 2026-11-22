import { describe, expect, it, vi } from "vitest";
import { RemoveMarketplacePlugins } from "../../../../src/orchestration/marketplace/remove/remove-marketplace-plugins.use-case.js";

const RESULT = { removedCount: 2, orphanCount: 0 };

function removerWith(answer: boolean) {
  const confirm = vi.fn().mockResolvedValue(answer);
  const plugins = {
    execute: vi.fn(async (command: { confirm: (count: number) => Promise<boolean> }) => {
      await command.confirm(2);
      return RESULT;
    }),
  };
  const records = { refOf: vi.fn(), withoutRef: vi.fn() };
  const useCase = new RemoveMarketplacePlugins(plugins, { confirm }, records);
  return { useCase, confirm, plugins };
}

describe("removing the plugins installed from a project marketplace", () => {
  it("asks the person, with the count, before removing", async () => {
    const { useCase, confirm } = removerWith(true);

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: false });

    expect(confirm).toHaveBeenCalledWith("Remove 2 plugin(s) installed from this marketplace?");
  });

  it("goes ahead without asking under --yes", async () => {
    const { useCase, confirm, plugins } = removerWith(false);

    const result = await useCase.execute({
      name: "market",
      projectRoot: "/project",
      autoConfirm: true,
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(plugins.execute).toHaveBeenCalledWith(
      expect.objectContaining({ marketplace: "market", projectRoot: "/project" })
    );
    expect(result).toBe(RESULT);
  });
});
