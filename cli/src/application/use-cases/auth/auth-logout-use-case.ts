import type { AuthLogoutResult, CredentialStore } from "../../../domain/ports/credential-store.js";

export class AuthLogoutUseCase {
  constructor(private readonly authProvider: CredentialStore) {}

  async execute(): Promise<AuthLogoutResult> {
    return await this.authProvider.logout();
  }
}
