import { describe, expect, it } from "vitest";
import { AuthStatusUseCase } from "../../../src/application/use-cases/auth/auth-status-use-case.js";
import { AuthenticationError } from "../../../src/domain/errors.js";
import type { AuthStatus, CredentialStore } from "../../../src/domain/ports/credential-store.js";

function makeCredentialStore(status: AuthStatus | null): CredentialStore {
  return {
    login: async () => {
      throw new Error("not called");
    },
    status: async () => {
      if (!status) throw new AuthenticationError("not authenticated");
      return status;
    },
    logout: async () => {
      throw new Error("not called");
    },
  };
}

describe("auth status", () => {
  it("returns status when provider resolves a valid login", async () => {
    const useCase = new AuthStatusUseCase(makeCredentialStore({ login: "octocat", level: "user" }));
    const result = await useCase.execute();
    expect(result.login).toBe("octocat");
    expect(result.level).toBe("user");
  });

  it("propagates error when provider throws", async () => {
    const useCase = new AuthStatusUseCase(makeCredentialStore(null));
    await expect(useCase.execute()).rejects.toThrow(/Authentication failed/);
  });
});
