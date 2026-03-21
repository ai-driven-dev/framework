import type { AuthTokenProvider } from "../domain/ports/auth-token-provider.js";

export async function requireAuth(authReader: AuthTokenProvider): Promise<void> {
  if ((await authReader.resolve()) === null) {
    throw new Error("Not authenticated. Run aidd auth login.");
  }
}
