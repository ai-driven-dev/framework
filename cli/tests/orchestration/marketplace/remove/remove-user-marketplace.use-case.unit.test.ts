import { describe, expect, it, vi } from "vitest";
import type { PurgeUserMarketplaceRequest } from "../../../../src/orchestration/marketplace/remove/purge-user-marketplace.use-case.js";
import { RemoveUserMarketplace } from "../../../../src/orchestration/marketplace/remove/remove-user-marketplace.use-case.js";

const FOUND = { name: "market", scope: "user", fingerprint: "fp" } as const;

function removerWith(purge: (command: PurgeUserMarketplaceRequest) => Promise<number>) {
  const find = { execute: vi.fn().mockResolvedValue(FOUND) };
  const remove = { execute: vi.fn().mockResolvedValue(undefined) };
  const useCase = new RemoveUserMarketplace({ find, purge: { execute: purge }, remove });
  return { useCase, find, remove };
}

describe("RemoveUserMarketplace", () => {
  it("purges what the machine holds for the marketplace it found", async () => {
    const purge = vi.fn().mockResolvedValue(3);
    const { useCase } = removerWith(purge);

    const result = await useCase.execute({
      name: "market",
      projectRoot: "/project",
      autoConfirm: true,
    });

    expect(purge).toHaveBeenCalledWith(
      expect.objectContaining({ marketplace: "market", projectRoot: "/project" })
    );
    expect(result).toEqual({ marketplace: FOUND, removedPluginCount: 3, orphanCount: 0 });
  });

  it("proves under the lock that the marketplace is still the one it found", async () => {
    const purge = vi.fn(async (command: PurgeUserMarketplaceRequest) => {
      await command.whileLocked();
      return 0;
    });
    const { useCase, find } = removerWith(purge);

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: true });

    expect(find.execute).toHaveBeenLastCalledWith({
      name: "market",
      projectRoot: "/project",
      unchangedSince: "fp",
    });
  });

  it("forgets the marketplace only when the purge asks for it", async () => {
    const purge = vi.fn(async (command: PurgeUserMarketplaceRequest) => {
      await command.forget();
      return 0;
    });
    const { useCase, remove } = removerWith(purge);
    expect(remove.execute).not.toHaveBeenCalled();

    await useCase.execute({ name: "market", projectRoot: "/project", autoConfirm: true });

    expect(remove.execute).toHaveBeenCalledWith({ projectRoot: "/project", marketplace: FOUND });
  });

  it("purges nothing when the marketplace is not found", async () => {
    const purge = vi.fn();
    const { useCase, find } = removerWith(purge);
    find.execute.mockRejectedValue(new Error("not found"));

    await expect(
      useCase.execute({ name: "ghost", projectRoot: "/project", autoConfirm: true })
    ).rejects.toThrow("not found");
    expect(purge).not.toHaveBeenCalled();
  });
});
