import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthLogoutUseCase } from "../../../src/application/use-cases/auth-logout-use-case.js";
import type { AuthStorage } from "../../../src/infrastructure/auth/auth-storage.js";
import { makeAuthConfig, makeTempAuthStorage } from "../../helpers/auth.js";

describe("AuthLogoutUseCase", () => {
  let tempDir: string;
  let storage: AuthStorage;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ tempDir, storage, cleanup } = await makeTempAuthStorage("auth-logout-test"));
  });

  afterEach(async () => {
    await cleanup();
  });

  it("returns found=false when no auth file exists", async () => {
    const useCase = new AuthLogoutUseCase(storage);
    const result = await useCase.execute({ projectRoot: tempDir });
    expect(result.found).toBe(false);
  });

  it("removes project auth.json and returns project level", async () => {
    const config = makeAuthConfig({ level: "project" });
    const path = storage.projectConfigPath(tempDir);
    await storage.write(path, config);

    const useCase = new AuthLogoutUseCase(storage);
    const result = await useCase.execute({ projectRoot: tempDir });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.level).toBe("project");
      expect(result.method).toBe("token");
      expect(result.ghHint).toBeUndefined();
    }

    const after = await storage.read(path);
    expect(after).toBeNull();
  });

  it("removes user auth.json when no project config found", async () => {
    await storage.write(storage.userConfigPath(), makeAuthConfig({ token: "ghp_user" }));

    const useCase = new AuthLogoutUseCase(storage);
    const result = await useCase.execute({ projectRoot: tempDir });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.level).toBe("user");
    }
  });

  it("provides gh hint when method=gh", async () => {
    await storage.write(
      storage.userConfigPath(),
      makeAuthConfig({ method: "gh", token: undefined })
    );

    const useCase = new AuthLogoutUseCase(storage);
    const result = await useCase.execute({ projectRoot: tempDir });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.ghHint).toContain("gh auth logout");
    }
  });
});
