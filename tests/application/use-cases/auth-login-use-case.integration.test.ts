import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthLoginUseCase } from "../../../src/application/use-cases/auth-login-use-case.js";
import type { ExternalTokenProvider } from "../../../src/domain/ports/external-token-provider.js";
import type { LoginVerifier } from "../../../src/domain/ports/login-verifier.js";
import type { AuthStorage } from "../../../src/infrastructure/auth/auth-storage.js";
import { makeTempAuthStorage } from "../../helpers/auth.js";

describe("auth login", () => {
  let tempDir: string;
  let storage: AuthStorage;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ tempDir, storage, cleanup } = await makeTempAuthStorage("auth-login-test"));
  });

  afterEach(async () => {
    await cleanup();
  });

  function makeVerifier(login: string): LoginVerifier {
    return { getLogin: async (_token: string) => login };
  }

  function makeFailingVerifier(statusCode: number): LoginVerifier {
    return {
      getLogin: async (_token: string) => {
        throw new Error(
          `Authentication failed (HTTP ${statusCode}). Run aidd auth login to authenticate.`
        );
      },
    };
  }

  function makeExternalProvider(token: string | null): ExternalTokenProvider {
    return { resolve: () => token };
  }

  describe("flag-based (non-interactive)", () => {
    it("stores token config at user level when method=token and level=user", async () => {
      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider(null)
      );
      const result = await useCase.execute({
        method: "token",
        token: "ghp_abc123",
        level: "user",
        projectRoot: tempDir,
        interactive: false,
      });

      expect(result.login).toBe("octocat");
      expect(result.method).toBe("token");
      expect(result.level).toBe("user");

      const storedConfig = await storage.read(storage.userConfigPath());
      expect(storedConfig).not.toBeNull();
      expect(storedConfig?.token).toBe("ghp_abc123");
      expect(storedConfig?.method).toBe("token");
    });

    it("stores gh config at project level when method=gh and level=project", async () => {
      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider("ghp_from_gh_cli")
      );
      const result = await useCase.execute({
        method: "gh",
        level: "project",
        projectRoot: tempDir,
        interactive: false,
      });

      expect(result.level).toBe("project");
      expect(result.method).toBe("gh");
      const projectPath = storage.projectConfigPath(tempDir);
      const storedConfig = await storage.read(projectPath);
      expect(storedConfig).not.toBeNull();
      expect(storedConfig?.method).toBe("gh");
    });

    it("propagates error when gh auth token fails (keyring, exit code, etc.)", async () => {
      const throwingProvider: ExternalTokenProvider = {
        resolve: () => {
          throw new Error(
            "gh auth token failed: could not retrieve credentials from system keyring"
          );
        },
      };
      const useCase = new AuthLoginUseCase(storage, makeVerifier("octocat"), throwingProvider);
      await expect(
        useCase.execute({
          method: "gh",
          level: "user",
          projectRoot: tempDir,
          interactive: false,
        })
      ).rejects.toThrow(/gh auth token failed/);
    });

    it("fails when gh CLI is not installed and method=gh", async () => {
      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider(null)
      );
      await expect(
        useCase.execute({
          method: "gh",
          level: "user",
          projectRoot: tempDir,
          interactive: false,
        })
      ).rejects.toThrow(/Authentication failed \(gh CLI\)/);
    });

    it("fails when token is invalid (HTTP 401)", async () => {
      const useCase = new AuthLoginUseCase(
        storage,
        makeFailingVerifier(401),
        makeExternalProvider(null)
      );
      await expect(
        useCase.execute({
          method: "token",
          token: "bad-token",
          level: "user",
          projectRoot: tempDir,
          interactive: false,
        })
      ).rejects.toThrow(/Authentication failed/);
    });

    it("fails when level is missing in non-interactive mode", async () => {
      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider(null)
      );
      await expect(
        useCase.execute({
          method: "token",
          token: "ghp_abc",
          projectRoot: tempDir,
          interactive: false,
        })
      ).rejects.toThrow(/level is required/);
    });
  });

  describe("interactive mode", () => {
    it("prompts for token when method=token and no --token flag", async () => {
      const inputCalled = vi.fn().mockResolvedValue("ghp_prompted");
      const prompter = {
        select: async <T>(_msg: string, choices: Array<{ name: string; value: T }>) =>
          choices[0].value,
        confirm: async (_msg: string) => false,
        input: inputCalled,
      };

      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider(null)
      );
      const result = await useCase.execute({
        method: "token",
        level: "user",
        projectRoot: tempDir,
        interactive: true,
        prompter,
      });

      expect(inputCalled).toHaveBeenCalledOnce();
      expect(result.method).toBe("token");
    });

    it("fails when token input is empty in interactive mode", async () => {
      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider(null)
      );
      await expect(
        useCase.execute({
          method: "token",
          level: "user",
          projectRoot: tempDir,
          interactive: true,
          prompter: {
            select: async <T>(_msg: string, choices: Array<{ name: string; value: T }>) =>
              choices[0].value,
            confirm: async (_msg: string) => false,
            input: async (_msg: string) => "",
          },
        })
      ).rejects.toThrow(/empty/);
    });
  });

  describe(".gitignore integration", () => {
    it("appends .aidd/auth.json to .gitignore when confirmed", async () => {
      const gitignorePath = join(tempDir, ".gitignore");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(gitignorePath, "node_modules\n");

      const prompter = {
        select: async <T>(_msg: string, choices: Array<{ name: string; value: T }>) =>
          choices[0].value,
        confirm: async (_msg: string) => true,
        input: async (_msg: string) => "",
      };

      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider(null)
      );
      await useCase.execute({
        method: "token",
        token: "ghp_abc",
        level: "project",
        projectRoot: tempDir,
        interactive: true,
        prompter,
      });

      const content = await readFile(gitignorePath, "utf-8");
      expect(content).toContain(".aidd/auth.json");
    });

    it("does not add to .gitignore when already present", async () => {
      const gitignorePath = join(tempDir, ".gitignore");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(gitignorePath, ".aidd/auth.json\n");

      const confirmCalled = vi.fn().mockResolvedValue(false);
      const prompter = {
        select: async <T>(_msg: string, choices: Array<{ name: string; value: T }>) =>
          choices[0].value,
        confirm: confirmCalled,
        input: async (_msg: string) => "",
      };

      const useCase = new AuthLoginUseCase(
        storage,
        makeVerifier("octocat"),
        makeExternalProvider(null)
      );
      await useCase.execute({
        method: "token",
        token: "ghp_abc",
        level: "project",
        projectRoot: tempDir,
        interactive: true,
        prompter,
      });

      expect(confirmCalled).not.toHaveBeenCalled();
    });
  });
});
