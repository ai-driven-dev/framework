import type { AuthCredential, AuthLevel } from "../../domain/models/auth.js";
import type { AuthLoginResult, AuthProvider } from "../../domain/ports/auth-provider.js";

interface AuthLoginOptions {
  credential: AuthCredential;
  level: AuthLevel;
}

export class AuthLoginUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(options: AuthLoginOptions): Promise<AuthLoginResult> {
    return await this.authProvider.login(options.credential, options.level);
  }
}
