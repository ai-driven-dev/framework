import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStatusUseCase } from "../../../src/application/use-cases/auth-status-use-case.js";
import type { AuthStorage } from "../../../src/infrastructure/auth/auth-storage.js";
import { makeAuthConfig, makeTempAuthStorage } from "../../helpers/auth.js";

describe("auth status", () => {
  let tempDir: string;
  let storage: AuthStorage;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ tempDir, storage, cleanup } = await makeTempAuthStorage("auth-status-test"));
  });

  afterEach(async () => {
    await cleanup();
  });

  const successHttpGet = async (_url: string, _token: string) => ({ login: "octocat" });
  const failHttpGet = async (): Promise<{ login: string }> => {
    throw new Error("Authentication failed (HTTP 401). Run aidd auth login to authenticate.");
  };

  it("reports unauthenticated when no token is available", async () => {
    const authReader = { resolve: async () => null };
    const useCase = new AuthStatusUseCase(authReader, storage);
    const result = await useCase.execute({ projectRoot: tempDir, httpGet: successHttpGet });
    expect(result.authenticated).toBe(false);
  });

  it("reports authenticated and valid when token resolves and GitHub API succeeds", async () => {
    await storage.write(storage.userConfigPath(), makeAuthConfig({ token: "ghp_valid" }));

    const authReader = { resolve: async () => "ghp_valid" };
    const useCase = new AuthStatusUseCase(authReader, storage);
    const result = await useCase.execute({ projectRoot: tempDir, httpGet: successHttpGet });

    expect(result.authenticated).toBe(true);
    if (result.authenticated && result.valid) {
      expect(result.login).toBe("octocat");
      expect(result.method).toBe("token");
      expect(result.level).toBe("user");
    }
  });

  it("reports authenticated but invalid when GitHub API fails", async () => {
    const authReader = { resolve: async () => "ghp_expired" };
    const useCase = new AuthStatusUseCase(authReader, storage);
    const result = await useCase.execute({ projectRoot: tempDir, httpGet: failHttpGet });

    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.valid).toBe(false);
    }
  });
});
