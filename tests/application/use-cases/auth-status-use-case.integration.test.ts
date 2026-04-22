import { describe, expect, it } from "vitest";
import { AuthStatusUseCase } from "../../../src/application/use-cases/auth-status-use-case.js";
import type { LoginVerifier } from "../../../src/domain/ports/login-verifier.js";

const successVerifier: LoginVerifier = { getLogin: async (_token) => "octocat" };
const failVerifier: LoginVerifier = {
  getLogin: async (_token) => {
    throw new Error("Authentication failed (HTTP 401).");
  },
};

describe("auth status", () => {
  it("returns valid login when verifier succeeds", async () => {
    const useCase = new AuthStatusUseCase();
    const result = await useCase.execute({
      token: "ghp_valid",
      method: "token",
      level: "user",
      verifier: successVerifier,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.login).toBe("octocat");
      expect(result.method).toBe("token");
      expect(result.level).toBe("user");
    }
  });

  it("returns invalid when verifier throws", async () => {
    const useCase = new AuthStatusUseCase();
    const result = await useCase.execute({
      token: "ghp_expired",
      method: "token",
      level: "user",
      verifier: failVerifier,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("401");
    }
  });
});
