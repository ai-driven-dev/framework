import type { AuthCredential, AuthLevel } from "../../../domain/models/auth.js";
import type { AuthLoginResult, CredentialStore } from "../../../domain/ports/credential-store.js";

interface AuthLoginOptions {
  credential: AuthCredential;
  level: AuthLevel;
}

export class AuthLoginUseCase {
  constructor(private readonly authProvider: CredentialStore) {}

  async execute(options: AuthLoginOptions): Promise<AuthLoginResult> {
    return await this.authProvider.login(options.credential, options.level);
  }
}
