import type { AuthTokenProvider } from "../../domain/ports/auth-token-provider.js";
import type { LoginVerifier } from "../../domain/ports/login-verifier.js";
import type { AuthStorage } from "../../infrastructure/auth/auth-storage.js";

interface AuthStatusOptions {
  projectRoot: string;
  verifiers: Record<"gh" | "token", LoginVerifier>;
}

type AuthStatusResult =
  | { authenticated: false }
  | { authenticated: true; valid: false; reason: string }
  | {
      authenticated: true;
      valid: true;
      method: "gh" | "token";
      level: "user" | "project";
      login: string;
    };

export class AuthStatusUseCase {
  constructor(
    private readonly authReader: AuthTokenProvider,
    private readonly storage: AuthStorage
  ) {}

  async execute(options: AuthStatusOptions): Promise<AuthStatusResult> {
    const token = await this.authReader.resolve();
    if (token === null) {
      return { authenticated: false };
    }

    const projectConfig = await this.storage.read(
      this.storage.projectConfigPath(options.projectRoot)
    );
    const userConfig = await this.storage.read(this.storage.userConfigPath());
    const config = projectConfig ?? userConfig;
    const method = config?.method ?? "token";
    const level = config?.level ?? "user";

    try {
      const login = await options.verifiers[method].getLogin(token);
      return { authenticated: true, valid: true, method, level, login };
    } catch (err) {
      return {
        authenticated: true,
        valid: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
