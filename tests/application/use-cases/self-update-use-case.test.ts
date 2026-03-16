import { describe, expect, it, vi } from "vitest";
import { SelfUpdateUseCase } from "../../../src/application/use-cases/self-update-use-case.js";
import type { CliUpdater } from "../../../src/domain/ports/cli-updater.js";
import type { CurrentVersionProvider } from "../../../src/domain/ports/current-version-provider.js";

function makeUseCase(
  currentVersion: string,
  latestVersion: string,
  installFn = vi.fn()
): { useCase: SelfUpdateUseCase; installFn: ReturnType<typeof vi.fn> } {
  const versionProvider: CurrentVersionProvider = { get: vi.fn().mockReturnValue(currentVersion) };
  const updater: CliUpdater = {
    fetchLatestRelease: vi
      .fn()
      .mockResolvedValue({ version: latestVersion, changelog: "Release notes" }),
    install: installFn,
  };
  return { useCase: new SelfUpdateUseCase(updater, versionProvider), installFn };
}

describe("SelfUpdateUseCase", () => {
  describe("--check", () => {
    it("returns check-available when a newer version exists", async () => {
      const { useCase } = makeUseCase("2.5.0", "2.6.0");
      const result = await useCase.execute({ check: true, dryRun: false, force: false });
      expect(result).toEqual({
        kind: "check-available",
        latestVersion: "2.6.0",
        currentVersion: "2.5.0",
      });
    });

    it("returns check-current when already on latest", async () => {
      const { useCase } = makeUseCase("2.5.0", "2.5.0");
      const result = await useCase.execute({ check: true, dryRun: false, force: false });
      expect(result).toEqual({ kind: "check-current", version: "2.5.0" });
    });

    it("does not install", async () => {
      const { useCase, installFn } = makeUseCase("2.5.0", "2.6.0");
      await useCase.execute({ check: true, dryRun: false, force: false });
      expect(installFn).not.toHaveBeenCalled();
    });
  });

  describe("no flags", () => {
    it("returns up-to-date when already on latest", async () => {
      const { useCase, installFn } = makeUseCase("2.5.0", "2.5.0");
      const result = await useCase.execute({ check: false, dryRun: false, force: false });
      expect(result).toEqual({ kind: "up-to-date", version: "2.5.0" });
      expect(installFn).not.toHaveBeenCalled();
    });

    it("installs and returns updated when outdated", async () => {
      const { useCase, installFn } = makeUseCase("2.5.0", "2.6.0");
      const result = await useCase.execute({ check: false, dryRun: false, force: false });
      expect(result).toEqual({
        kind: "updated",
        latestVersion: "2.6.0",
        changelog: "Release notes",
      });
      expect(installFn).toHaveBeenCalledOnce();
    });
  });

  describe("--dry-run", () => {
    it("returns dry-run result without installing", async () => {
      const { useCase, installFn } = makeUseCase("2.5.0", "2.6.0");
      const result = await useCase.execute({ check: false, dryRun: true, force: false });
      expect(result).toEqual({ kind: "dry-run", latestVersion: "2.6.0" });
      expect(installFn).not.toHaveBeenCalled();
    });
  });

  describe("--force", () => {
    it("reinstalls even when already on latest", async () => {
      const { useCase, installFn } = makeUseCase("2.5.0", "2.5.0");
      const result = await useCase.execute({ check: false, dryRun: false, force: true });
      expect(result).toEqual({
        kind: "updated",
        latestVersion: "2.5.0",
        changelog: "Release notes",
      });
      expect(installFn).toHaveBeenCalledOnce();
    });
  });
});
