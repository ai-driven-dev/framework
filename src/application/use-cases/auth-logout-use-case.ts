import type { AuthLogoutResult, AuthProvider } from "../../domain/ports/auth-provider.js";

export class AuthLogoutUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(): Promise<AuthLogoutResult> {
    return await this.authProvider.logout();
  }
}
