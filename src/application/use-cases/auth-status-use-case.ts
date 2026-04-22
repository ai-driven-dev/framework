import type { AuthProvider, AuthStatus } from "../../domain/ports/auth-provider.js";

export class AuthStatusUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(): Promise<AuthStatus> {
    return await this.authProvider.status();
  }
}
