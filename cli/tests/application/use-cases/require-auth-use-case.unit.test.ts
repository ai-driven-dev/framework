import { describe, expect, it } from "vitest";
import { NotAuthenticatedError } from "../../../src/application/errors.js";
import { RequireAuthUseCase } from "../../../src/application/use-cases/auth/require-auth-use-case.js";
import type { TokenProvider } from "../../../src/domain/ports/token-provider.js";

function makeTokenProvider(token: string | null): TokenProvider {
  return { resolve: async () => token };
}

describe("RequireAuthUseCase", () => {
  it("resolves without throwing when token is present", async () => {
    const useCase = new RequireAuthUseCase(makeTokenProvider("ghp_abc123"));
    await expect(useCase.execute()).resolves.not.toThrow();
  });

  it("throws NotAuthenticatedError when token is null", async () => {
    const useCase = new RequireAuthUseCase(makeTokenProvider(null));
    await expect(useCase.execute()).rejects.toThrow(NotAuthenticatedError);
  });
});
