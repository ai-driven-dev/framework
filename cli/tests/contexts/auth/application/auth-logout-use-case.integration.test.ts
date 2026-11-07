import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthLogoutUseCase } from "../../../../src/contexts/auth/application/auth-logout-use-case.js";
import { AuthProviderAdapter } from "../../../../src/contexts/auth/infrastructure/auth-provider-adapter.js";
import type { AuthStorage } from "../../../../src/contexts/auth/infrastructure/auth-storage.js";
import { GhCliAdapter } from "../../../../src/contexts/auth/infrastructure/gh-cli-adapter.js";
import type { CredentialStore } from "../../../../src/contexts/auth/ports/credential-store.js";
import { GitHubAdapter } from "../../../../src/shared/infrastructure/github-adapter.js";
import { HttpClient } from "../../../../src/shared/infrastructure/http-client.js";
import { makeAuthConfig, makeTempAuthStorage } from "../../../helpers/auth.js";

describe("auth logout", () => {
  let tempDir: string;
  let storage: AuthStorage;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ tempDir, storage, cleanup } = await makeTempAuthStorage("auth-logout-test"));
  });

  afterEach(async () => {
    await cleanup();
  });

  function makeProvider(): CredentialStore {
    const http = new HttpClient();
    return new AuthProviderAdapter(
      storage,
      new Map([["gh", new GhCliAdapter()]]),
      new GitHubAdapter(http),
      tempDir
    );
  }

  it("reports no auth file found when user is not logged in", async () => {
    const useCase = new AuthLogoutUseCase(makeProvider());
    const result = await useCase.execute();
    expect(result.found).toBe(false);
  });

  it("removes project auth.json and returns project level", async () => {
    const config = makeAuthConfig({ level: "project" });
    const path = storage.projectConfigPath(tempDir);
    await storage.write(path, config);

    const useCase = new AuthLogoutUseCase(makeProvider());
    const result = await useCase.execute();

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.level).toBe("project");
      expect(result.hint).toBeUndefined();
    }

    const after = await storage.read(path);
    expect(after).toBeNull();
  });

  it("with a record at both levels, removes the project one and keeps the user one", async () => {
    const projectPath = storage.projectConfigPath(tempDir);
    const userPath = storage.userConfigPath();
    await storage.write(projectPath, makeAuthConfig({ level: "project" }));
    await storage.write(userPath, makeAuthConfig({ token: "ghp_user" }));

    const result = await new AuthLogoutUseCase(makeProvider()).execute();

    expect(result.found && result.level).toBe("project");
    expect(await storage.read(projectPath)).toBeNull();
    expect(await storage.read(userPath)).not.toBeNull();
  });

  it("removes user auth.json when no project config found", async () => {
    await storage.write(storage.userConfigPath(), makeAuthConfig({ token: "ghp_user" }));

    const useCase = new AuthLogoutUseCase(makeProvider());
    const result = await useCase.execute();

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.level).toBe("user");
    }
  });

  it("sets external-provider-cleanup hint when method=external", async () => {
    await storage.write(
      storage.userConfigPath(),
      makeAuthConfig({ method: "external", token: undefined })
    );

    const useCase = new AuthLogoutUseCase(makeProvider());
    const result = await useCase.execute();

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.hint).toBe("external-provider-cleanup");
    }
  });
});
